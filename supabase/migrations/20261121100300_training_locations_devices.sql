-- Training module, part 3: where a workout happens and device-aware history.
--
-- * Training types decide the default place (data, not code):
--     home_studio → the person's home studio (Studio)
--     private     → the person's own private place, created on first use (Home Gym)
--     none        → no place (Laufen, Fußball …)
-- * Devices can be "comparable everywhere" (dumbbells, bench, pull-up bar): their history is
--   shared across places. Machines (default) only compare with the very same device.

alter table public.training_types
  add column location_mode text not null default 'none'
    check (location_mode in ('home_studio', 'private', 'none'));
update public.training_types set location_mode = 'home_studio' where owner_id is null and name = 'Studio';
update public.training_types set location_mode = 'private' where owner_id is null and name = 'Home Gym';
grant update (location_mode) on public.training_types to authenticated;

-- Variants of a type (data), e.g. Laufen: Outdoor / Laufband. A workout records which one.
alter table public.training_types
  add column variants text[] not null default '{}'
    check (cardinality(variants) <= 8);
grant update (variants) on public.training_types to authenticated;
update public.training_types set variants = array['Outdoor', 'Laufband']
 where owner_id is null and name = 'Laufen';
insert into public.training_types (name, kind, with_distance, sort, variants)
values ('Radfahren', 'duration', true, 35, array['Outdoor', 'Indoor']);

alter table public.workouts
  add column variant text check (variant is null or char_length(variant) <= 40);
grant update (variant) on public.workouts to authenticated;

alter table public.devices add column comparable boolean not null default false;
grant update (comparable) on public.devices to authenticated;

-- An extra muscle group needed for the adductor machine.
insert into public.muscle_groups (key, label, sort) values ('adductors', 'Adduktoren', 105);

-- ---------------------------------------------------------------------------
-- start_workout: resolve the place from the training type when none is given.
-- ---------------------------------------------------------------------------
create or replace function public.start_workout(
  p_training_type_id uuid,
  p_location_id uuid default null
)
returns public.workouts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type public.training_types%rowtype;
  v_location uuid := p_location_id;
  v_workout public.workouts%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into v_type from public.training_types t
   where t.id = p_training_type_id
     and t.archived_at is null
     and (t.owner_id is null or t.owner_id = auth.uid());
  if not found then
    raise exception 'invalid_training_type' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.workouts where user_id = auth.uid() and status = 'active') then
    raise exception 'workout_already_active' using errcode = 'P0001';
  end if;

  if v_location is null and v_type.location_mode = 'home_studio' then
    select tp.home_location_id into v_location
      from public.training_prefs tp where tp.user_id = auth.uid();
  elsif v_location is null and v_type.location_mode = 'private' then
    select l.id into v_location from public.locations l
     where l.owner_id = auth.uid() order by l.created_at limit 1;
    if v_location is null then
      insert into public.locations (name, owner_id, created_by)
      values (v_type.name, auth.uid(), auth.uid())
      returning id into v_location;
    end if;
  end if;

  insert into public.workouts (user_id, training_type_id, location_id)
  values (auth.uid(), p_training_type_id,
          case when v_location is not null and private.can_view_location(v_location)
               then v_location end)
  returning * into v_workout;
  return v_workout;
end;
$$;

-- ---------------------------------------------------------------------------
-- History by device: a machine compares with itself; everything else (comparable
-- devices or no device) shares one history per exercise.
-- ---------------------------------------------------------------------------
create function private.history_scope_matches(p_device_id uuid, p_item_device_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_device_id is not null
         and not coalesce((select d.comparable from public.devices d where d.id = p_device_id), true)
      then p_item_device_id = p_device_id
    else p_item_device_id is null
      or coalesce((select d.comparable from public.devices d where d.id = p_item_device_id), true)
  end;
$$;
revoke all on function private.history_scope_matches(uuid, uuid) from public;
grant execute on function private.history_scope_matches(uuid, uuid) to authenticated;

drop function public.previous_sets(uuid);
create function public.previous_sets(p_exercise_id uuid, p_device_id uuid default null)
returns table (
  set_position integer,
  weight_kg numeric,
  reps integer,
  duration_seconds integer,
  is_warmup boolean,
  workout_started_at timestamptz,
  same_device boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  -- Prefer the same scope (same machine / comparable); fall back to any device of this
  -- exercise so there is at least an orientation ("other device").
  with candidates as (
    select i.id, w.started_at,
           private.history_scope_matches(p_device_id, i.device_id) as same_device
      from public.workout_items i
      join public.workouts w on w.id = i.workout_id
     where w.user_id = (select auth.uid())
       and w.status = 'finished'
       and i.exercise_id = p_exercise_id
  ),
  last_item as (
    select * from candidates
     order by same_device desc, started_at desc
     limit 1
  )
  select row_number() over (order by s.position)::integer - 1,
         s.weight_kg, s.reps, s.duration_seconds, s.is_warmup, li.started_at, li.same_device
    from last_item li
    join public.workout_sets s on s.item_id = li.id
   where s.completed_at is not null
   order by s.position;
$$;

drop function public.exercise_trend(uuid, integer);
create function public.exercise_trend(
  p_exercise_id uuid,
  p_limit integer default 6,
  p_device_id uuid default null
)
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
       and private.history_scope_matches(p_device_id, i.device_id)
       and s.completed_at is not null
       and not s.is_warmup
     group by w.id, w.started_at
     order by w.started_at desc
     limit least(greatest(p_limit, 1), 30)
  )
  select started_at, value from per_workout order by started_at;
$$;

revoke all on function public.previous_sets(uuid, uuid) from public, anon;
revoke all on function public.exercise_trend(uuid, integer, uuid) from public, anon;
grant execute on function public.previous_sets(uuid, uuid) to authenticated;
grant execute on function public.exercise_trend(uuid, integer, uuid) to authenticated;
