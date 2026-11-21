-- Training module, part 2: workouts, their exercises and sets.
-- Personal module (rule 13): owner via auth.users, visibility via can_view_user_data.
--
-- A workout is either
--   kind "exercises": items (exercises) with sets, each set saved the moment it is ticked;
--   kind "duration":  a single entry with duration (± distance, intensity, note).

create type public.workout_status as enum ('active', 'finished');

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  training_type_id uuid not null references public.training_types (id),
  location_id uuid references public.locations (id) on delete set null,
  status public.workout_status not null default 'active',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  -- Pause bookkeeping: total paused seconds plus the start of a running pause.
  paused_seconds integer not null default 0 check (paused_seconds >= 0),
  paused_at timestamptz,
  -- Duration-type entries (and optional for all): duration, distance, intensity, note.
  duration_seconds integer check (duration_seconds is null or duration_seconds between 1 and 86400),
  distance_m integer check (distance_m is null or distance_m between 1 and 1000000),
  intensity smallint check (intensity is null or intensity between 1 and 5),
  note text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  constraint workouts_finished_has_end check ((status = 'finished') = (ended_at is not null))
);
create index workouts_user_started_idx on public.workouts (user_id, started_at desc);
-- At most one running workout per person.
create unique index workouts_one_active_idx on public.workouts (user_id) where status = 'active';

create table public.workout_items (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id),
  device_id uuid references public.devices (id) on delete set null,
  position integer not null check (position >= 0),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now()
);
create index workout_items_workout_idx on public.workout_items (workout_id, position);
create index workout_items_exercise_idx on public.workout_items (exercise_id);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.workout_items (id) on delete cascade,
  position integer not null check (position >= 0),
  weight_kg numeric(6, 2) check (weight_kg is null or weight_kg between 0 and 1000),
  reps integer check (reps is null or reps between 0 and 1000),
  duration_seconds integer check (duration_seconds is null or duration_seconds between 0 and 36000),
  is_warmup boolean not null default false,
  -- Set when ticked; only completed sets count for history, volume and bests.
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index workout_sets_item_idx on public.workout_sets (item_id, position);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create function private.workout_owner(p_workout_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select w.user_id from public.workouts w where w.id = p_workout_id;
$$;

create function private.item_owner(p_item_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select w.user_id
    from public.workout_items i
    join public.workouts w on w.id = i.workout_id
   where i.id = p_item_id;
$$;

revoke all on function private.workout_owner(uuid), private.item_owner(uuid) from public;
grant execute on function private.workout_owner(uuid), private.item_owner(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Transitions (server-side, rule 14)
-- ---------------------------------------------------------------------------
-- Errors (message): not_authenticated, workout_already_active, invalid_training_type
create function public.start_workout(
  p_training_type_id uuid,
  p_location_id uuid default null
)
returns public.workouts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workout public.workouts%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.training_types t
     where t.id = p_training_type_id
       and t.archived_at is null
       and (t.owner_id is null or t.owner_id = auth.uid())
  ) then
    raise exception 'invalid_training_type' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.workouts where user_id = auth.uid() and status = 'active') then
    raise exception 'workout_already_active' using errcode = 'P0001';
  end if;

  insert into public.workouts (user_id, training_type_id, location_id)
  values (auth.uid(), p_training_type_id,
          case when p_location_id is not null and private.can_view_location(p_location_id)
               then p_location_id end)
  returning * into v_workout;
  return v_workout;
end;
$$;

-- Ends a workout: closes a running pause and drops sets that were never ticked.
-- Errors: workout_not_found
create function public.finish_workout(p_workout_id uuid)
returns public.workouts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workout public.workouts%rowtype;
begin
  select * into v_workout from public.workouts
   where id = p_workout_id and user_id = auth.uid() and status = 'active'
   for update;
  if not found then
    raise exception 'workout_not_found' using errcode = 'P0001';
  end if;

  delete from public.workout_sets s
   using public.workout_items i
   where s.item_id = i.id and i.workout_id = p_workout_id and s.completed_at is null;
  delete from public.workout_items i
   where i.workout_id = p_workout_id
     and not exists (select 1 from public.workout_sets s where s.item_id = i.id);

  update public.workouts
     set status = 'finished',
         ended_at = now(),
         paused_seconds = paused_seconds
           + coalesce(extract(epoch from now() - paused_at)::integer, 0),
         paused_at = null
   where id = p_workout_id
  returning * into v_workout;
  return v_workout;
end;
$$;

-- ---------------------------------------------------------------------------
-- History for the workout screen
-- ---------------------------------------------------------------------------
-- Sets of my most recent finished workout with this exercise ("vorher" column).
create function public.previous_sets(p_exercise_id uuid)
returns table (
  set_position integer,
  weight_kg numeric,
  reps integer,
  duration_seconds integer,
  is_warmup boolean,
  workout_started_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with last_item as (
    select i.id, w.started_at
      from public.workout_items i
      join public.workouts w on w.id = i.workout_id
     where w.user_id = (select auth.uid())
       and w.status = 'finished'
       and i.exercise_id = p_exercise_id
     order by w.started_at desc, i.position
     limit 1
  )
  select row_number() over (order by s.position)::integer - 1,
         s.weight_kg, s.reps, s.duration_seconds, s.is_warmup, li.started_at
    from last_item li
    join public.workout_sets s on s.item_id = li.id
   where s.completed_at is not null
   order by s.position;
$$;

-- Best working set per finished workout for the mini chart (last N workouts, oldest first).
-- value: weight (weight_reps), reps (reps), seconds (duration).
create function public.exercise_trend(p_exercise_id uuid, p_limit integer default 6)
returns table (workout_started_at timestamptz, value numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  with per_workout as (
    select w.started_at,
           max(case e.measure
                 when 'weight_reps' then s.weight_kg
                 when 'reps' then s.reps::numeric
                 else s.duration_seconds::numeric
               end) as value
      from public.workout_items i
      join public.workouts w on w.id = i.workout_id
      join public.exercises e on e.id = i.exercise_id
      join public.workout_sets s on s.item_id = i.id
     where w.user_id = (select auth.uid())
       and w.status = 'finished'
       and i.exercise_id = p_exercise_id
       and s.completed_at is not null
       and not s.is_warmup
     group by w.id, w.started_at
     order by w.started_at desc
     limit least(greatest(p_limit, 1), 30)
  )
  select started_at, value from per_workout order by started_at;
$$;

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------
revoke all on public.workouts, public.workout_items, public.workout_sets from anon, authenticated;

grant select, delete on public.workouts to authenticated;
grant update (location_id, paused_seconds, paused_at, duration_seconds, distance_m, intensity, note)
  on public.workouts to authenticated;
grant select, insert, delete on public.workout_items to authenticated;
grant update (exercise_id, device_id, position, note) on public.workout_items to authenticated;
grant select, insert, delete on public.workout_sets to authenticated;
grant update (position, weight_kg, reps, duration_seconds, is_warmup, completed_at)
  on public.workout_sets to authenticated;

alter table public.workouts enable row level security;
alter table public.workout_items enable row level security;
alter table public.workout_sets enable row level security;

create policy "workouts: own and shared" on public.workouts
  for select to authenticated
  using (private.can_view_user_data(user_id, 'training'));
create policy "workouts: owner edits" on public.workouts
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
-- Discarding a workout deletes it (with confirmation in the UI).
create policy "workouts: owner deletes" on public.workouts
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "workout_items: own and shared" on public.workout_items
  for select to authenticated
  using (private.can_view_user_data(private.workout_owner(workout_id), 'training'));
create policy "workout_items: owner adds" on public.workout_items
  for insert to authenticated
  with check (private.workout_owner(workout_id) = (select auth.uid()));
create policy "workout_items: owner edits" on public.workout_items
  for update to authenticated
  using (private.workout_owner(workout_id) = (select auth.uid()))
  with check (private.workout_owner(workout_id) = (select auth.uid()));
create policy "workout_items: owner removes" on public.workout_items
  for delete to authenticated
  using (private.workout_owner(workout_id) = (select auth.uid()));

create policy "workout_sets: own and shared" on public.workout_sets
  for select to authenticated
  using (private.can_view_user_data(private.item_owner(item_id), 'training'));
create policy "workout_sets: owner adds" on public.workout_sets
  for insert to authenticated
  with check (private.item_owner(item_id) = (select auth.uid()));
create policy "workout_sets: owner edits" on public.workout_sets
  for update to authenticated
  using (private.item_owner(item_id) = (select auth.uid()))
  with check (private.item_owner(item_id) = (select auth.uid()));
create policy "workout_sets: owner removes" on public.workout_sets
  for delete to authenticated
  using (private.item_owner(item_id) = (select auth.uid()));

revoke all on function public.start_workout(uuid, uuid) from public, anon;
revoke all on function public.finish_workout(uuid) from public, anon;
revoke all on function public.previous_sets(uuid) from public, anon;
revoke all on function public.exercise_trend(uuid, integer) from public, anon;
grant execute on function public.start_workout(uuid, uuid) to authenticated;
grant execute on function public.finish_workout(uuid) to authenticated;
grant execute on function public.previous_sets(uuid) to authenticated;
grant execute on function public.exercise_trend(uuid, integer) to authenticated;
