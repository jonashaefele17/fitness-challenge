-- Baustein 5c: training together (social module "live-training").
--
-- A session joins the workouts of people training a plan date together. Everyone keeps
-- their own workout (personal) and logs only their own sets. Exercises are shared: an
-- exercise added, removed (if the others have no done sets in it yet), brought back or moved
-- by one person changes the others' workouts too; "nur für mich" keeps it personal. Shared
-- exercises are tied together by a key (live_items). All of it runs here in the database,
-- the training module knows nothing of it.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  plan_id uuid not null references public.plans (id) on delete cascade,
  -- The plan date as planned.
  plan_on date not null,
  started_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
-- One running session per plan date.
create unique index live_sessions_running_idx on public.live_sessions (plan_id, plan_on)
  where ended_at is null;

create table public.live_members (
  session_id uuid not null references public.live_sessions (id) on delete cascade,
  workout_id uuid not null unique references public.workouts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

-- Shared exercises: every workout's copy of one shared exercise has the same key. Rows stay
-- when an item is removed (no foreign key), so bringing it back restores it for all.
create table public.live_items (
  item_id uuid primary key,
  session_id uuid not null references public.live_sessions (id) on delete cascade,
  workout_id uuid not null,
  key uuid not null
);
create index live_items_key_idx on public.live_items (session_id, key);

-- Exercises added "nur für mich" (marked before they are inserted).
create table public.live_private_items (
  item_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.live_sessions enable row level security;
alter table public.live_members enable row level security;
alter table public.live_items enable row level security;
alter table public.live_private_items enable row level security;
revoke all on public.live_sessions, public.live_members, public.live_items,
  public.live_private_items from anon, authenticated;
grant select on public.live_sessions, public.live_members, public.live_items to authenticated;

create policy "live_sessions: group members read" on public.live_sessions
  for select to authenticated using (private.is_group_member(group_id));
create policy "live_members: group members read" on public.live_members
  for select to authenticated
  using (exists (select 1 from public.live_sessions s
                  where s.id = session_id and private.is_group_member(s.group_id)));
create policy "live_items: group members read" on public.live_items
  for select to authenticated
  using (exists (select 1 from public.live_sessions s
                  where s.id = session_id and private.is_group_member(s.group_id)));

-- ---------------------------------------------------------------------------
-- Keeping the shared exercises in step
-- ---------------------------------------------------------------------------
create function private.live_propagating()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('app.live_propagating', true), '') = 'on';
$$;

-- The running session a workout takes part in (null if none).
create function private.live_session_of(p_workout_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.session_id from public.live_members m
    join public.live_sessions s on s.id = m.session_id
   where m.workout_id = p_workout_id and s.ended_at is null;
$$;

-- The others' workouts take the shared exercises in the order of p_workout_id; their own
-- exercises keep their places.
create function private.live_sync_order(p_session_id uuid, p_workout_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_other uuid;
begin
  perform set_config('app.live_propagating', 'on', true);
  for v_other in
    select m.workout_id from public.live_members m
      join public.workouts w on w.id = m.workout_id and w.status = 'active'
     where m.session_id = p_session_id and m.workout_id <> p_workout_id
  loop
    with slots as (
      -- the places of the shared exercises both workouts have, in order (the others keep
      -- their places)
      select i.id, row_number() over (order by i.position) as n
        from public.workout_items i
        join public.live_items l on l.item_id = i.id
       where i.workout_id = v_other
         and exists (select 1 from public.live_items sl
                       join public.workout_items si on si.id = sl.item_id
                      where sl.session_id = l.session_id and sl.key = l.key
                        and si.workout_id = p_workout_id)
    ),
    wanted as (
      -- the shared exercises of the other workout, in the order of the source
      select oi.id, row_number() over (order by si.position) as n
        from public.workout_items oi
        join public.live_items ol on ol.item_id = oi.id
        join public.live_items sl on sl.session_id = ol.session_id and sl.key = ol.key
                                  and sl.workout_id = p_workout_id
        join public.workout_items si on si.id = sl.item_id
       where oi.workout_id = v_other
    ),
    target as (
      select w.id, p.position
        from wanted w
        join slots s on s.n = w.n
        join public.workout_items p on p.id = s.id
    )
    update public.workout_items i set position = t.position
      from target t
     where i.id = t.id and i.position is distinct from t.position;
  end loop;
  perform set_config('app.live_propagating', 'off', true);
end;
$$;

-- An exercise in a session workout: share it (new key, or the key it had before removal,
-- or the key of the same exercise the others already have) and add it where it is missing.
create function private.live_share_item(p_session_id uuid, p_item public.workout_items)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key uuid;
  v_other uuid;
  v_copy uuid;
begin
  if exists (select 1 from public.live_private_items where item_id = p_item.id) then
    return;
  end if;
  select l.key into v_key from public.live_items l where l.item_id = p_item.id;
  if v_key is null then
    -- the same exercise is already shared, but not yet in this workout: join it
    select l.key into v_key
      from public.live_items l
      join public.workout_items i on i.id = l.item_id
     where l.session_id = p_session_id and i.exercise_id = p_item.exercise_id
       and not exists (select 1 from public.live_items mine
                        join public.workout_items mi on mi.id = mine.item_id
                       where mine.key = l.key and mi.workout_id = p_item.workout_id)
     limit 1;
    v_key := coalesce(v_key, gen_random_uuid());
    insert into public.live_items (item_id, session_id, workout_id, key)
    values (p_item.id, p_session_id, p_item.workout_id, v_key);
  end if;

  perform set_config('app.live_propagating', 'on', true);
  for v_other in
    select m.workout_id from public.live_members m
      join public.workouts w on w.id = m.workout_id and w.status = 'active'
     where m.session_id = p_session_id and m.workout_id <> p_item.workout_id
       and not exists (select 1 from public.live_items l
                        join public.workout_items i on i.id = l.item_id
                       where l.key = v_key and i.workout_id = m.workout_id)
  loop
    insert into public.workout_items (workout_id, exercise_id, position)
    values (v_other, p_item.exercise_id,
            coalesce((select max(position) + 1 from public.workout_items where workout_id = v_other), 0))
    returning id into v_copy;
    insert into public.workout_sets (item_id, position) values (v_copy, 0);
    insert into public.live_items (item_id, session_id, workout_id, key)
    values (v_copy, p_session_id, v_other, v_key);
  end loop;
  perform set_config('app.live_propagating', 'off', true);
end;
$$;

create function private.on_live_item_inserted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session uuid;
begin
  if private.live_propagating() then
    return null;
  end if;
  v_session := private.live_session_of(new.workout_id);
  if v_session is null then
    return null;
  end if;
  perform private.live_share_item(v_session, new);
  perform private.live_sync_order(v_session, new.workout_id);
  return null;
end;
$$;

create trigger workout_items_after_insert_live
  after insert on public.workout_items
  for each row execute function private.on_live_item_inserted();

create function private.on_live_item_moved()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session uuid;
begin
  if private.live_propagating()
     or not exists (select 1 from public.live_items where item_id = new.id) then
    return null;
  end if;
  v_session := private.live_session_of(new.workout_id);
  if v_session is not null then
    perform private.live_sync_order(v_session, new.workout_id);
  end if;
  return null;
end;
$$;

create trigger workout_items_after_move_live
  after update of position on public.workout_items
  for each row execute function private.on_live_item_moved();

-- Removed: gone for the others too, unless they already have done sets in it.
create function private.on_live_item_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.live_items%rowtype;
begin
  if private.live_propagating() then
    return null;
  end if;
  select * into v_link from public.live_items where item_id = old.id;
  if not found or private.live_session_of(old.workout_id) is null then
    return null;
  end if;
  perform set_config('app.live_propagating', 'on', true);
  delete from public.workout_items i
   using public.live_items l, public.workouts w
   where l.session_id = v_link.session_id and l.key = v_link.key and l.item_id = i.id
     and i.id <> old.id and w.id = i.workout_id and w.status = 'active'
     and not exists (select 1 from public.workout_sets s
                      where s.item_id = i.id and s.completed_at is not null);
  perform set_config('app.live_propagating', 'off', true);
  return null;
end;
$$;

create trigger workout_items_after_delete_live
  after delete on public.workout_items
  for each row execute function private.on_live_item_deleted();

-- ---------------------------------------------------------------------------
-- Joining: a workout becomes part of a session; it gets the shared list and shares its own
-- ---------------------------------------------------------------------------
create function private.live_attach(p_session_id uuid, p_workout_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.workout_items%rowtype;
  v_source uuid;
  v_shared record;
  v_copy uuid;
begin
  insert into public.live_members (session_id, workout_id, user_id)
  select p_session_id, w.id, w.user_id from public.workouts w where w.id = p_workout_id
  on conflict do nothing;

  -- What this workout already has (e.g. from a template) is shared.
  for v_item in
    select * from public.workout_items where workout_id = p_workout_id order by position
  loop
    perform private.live_share_item(p_session_id, v_item);
  end loop;

  -- What the others share and this workout misses (in the order of the longest-running one).
  select m.workout_id into v_source from public.live_members m
   where m.session_id = p_session_id and m.workout_id <> p_workout_id
   order by m.joined_at limit 1;
  if v_source is null then
    return;
  end if;
  perform set_config('app.live_propagating', 'on', true);
  for v_shared in
    select distinct on (l.key) l.key, i.exercise_id, i.position
      from public.live_items l
      join public.workout_items i on i.id = l.item_id
     where l.session_id = p_session_id
       and not exists (select 1 from public.live_items mine
                        join public.workout_items mi on mi.id = mine.item_id
                       where mine.key = l.key and mi.workout_id = p_workout_id)
     order by l.key, (l.workout_id = v_source) desc, i.position
  loop
    insert into public.workout_items (workout_id, exercise_id, position)
    values (p_workout_id, v_shared.exercise_id,
            coalesce((select max(position) + 1 from public.workout_items where workout_id = p_workout_id), 0))
    returning id into v_copy;
    insert into public.workout_sets (item_id, position) values (v_copy, 0);
    insert into public.live_items (item_id, session_id, workout_id, key)
    values (v_copy, p_session_id, p_workout_id, v_shared.key);
  end loop;
  perform set_config('app.live_propagating', 'off', true);
  -- Same order as the others.
  perform private.live_sync_order(p_session_id, v_source);
end;
$$;

-- People who take part in a plan (the owner and everyone invited who has not said no).
create function private.live_plan_people(p_plan_id uuid, p_plan_on date)
returns table (user_id uuid, group_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select pp.user_id, pp.group_id
    from public.plan_participants pp
   where pp.plan_id = p_plan_id and pp.status in ('invited', 'accepted', 'maybe')
     and not exists (select 1 from public.plan_responses r
                      where r.plan_id = pp.plan_id and r.user_id = pp.user_id
                        and r.on_date = p_plan_on and r.status = 'declined');
$$;

-- The owner starts a plan date with people (training's start_workout with a plan): a session
-- starts, or the running one is joined. Deferred, so a template's exercises are in already.
create function private.on_live_workout_started()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session uuid;
  v_group uuid;
begin
  if new.plan_id is null or new.status <> 'active'
     or exists (select 1 from public.live_members where workout_id = new.id) then
    return null;
  end if;
  select s.id into v_session from public.live_sessions s
   where s.plan_id = new.plan_id and s.plan_on = new.plan_on and s.ended_at is null;
  if v_session is null then
    select p.group_id into v_group from private.live_plan_people(new.plan_id, new.plan_on) p limit 1;
    if v_group is null then
      return null;
    end if;
    insert into public.live_sessions (group_id, plan_id, plan_on, started_by)
    values (v_group, new.plan_id, new.plan_on, new.user_id)
    returning id into v_session;
  end if;
  perform private.live_attach(v_session, new.id);
  return null;
end;
$$;

create constraint trigger workouts_after_insert_live
  after insert on public.workouts
  deferrable initially deferred
  for each row execute function private.on_live_workout_started();


-- A session ends when nobody trains in it any more (finished or thrown away).
create function private.live_end_if_alone(p_workout_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.live_sessions s set ended_at = now()
    from public.live_members me
   where me.workout_id = p_workout_id and s.id = me.session_id and s.ended_at is null
     and not exists (select 1 from public.live_members m
                      join public.workouts w on w.id = m.workout_id
                     where m.session_id = s.id and w.status = 'active' and w.id <> p_workout_id);
$$;

create function private.on_live_workout_finished()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'active' and old.status = 'active' then
    perform private.live_end_if_alone(new.id);
  end if;
  return null;
end;
$$;

create trigger workouts_after_finish_live
  after update of status on public.workouts
  for each row execute function private.on_live_workout_finished();

create function private.on_live_workout_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.live_end_if_alone(old.id);
  return old;
end;
$$;

create trigger workouts_before_delete_live
  before delete on public.workouts
  for each row execute function private.on_live_workout_deleted();

-- ---------------------------------------------------------------------------
-- For the app
-- ---------------------------------------------------------------------------

-- Someone invited starts (or joins) a plan date of someone else: their own workout of the
-- plan's training type, in the session of that date.
create function public.live_start(p_plan_id uuid, p_plan_on date, p_template_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.plans%rowtype;
  v_group uuid;
  v_session uuid;
  v_workout public.workouts%rowtype;
begin
  select * into v_plan from public.plans p where p.id = p_plan_id;
  select p.group_id into v_group from private.live_plan_people(p_plan_id, p_plan_on) p
   where p.user_id = auth.uid();
  if v_plan.id is null or v_group is null or v_plan.kind <> 'training' then
    raise exception 'not_invited' using errcode = '42501';
  end if;

  select s.id into v_session from public.live_sessions s
   where s.plan_id = p_plan_id and s.plan_on = p_plan_on and s.ended_at is null;
  if v_session is null then
    insert into public.live_sessions (group_id, plan_id, plan_on, started_by)
    values (v_group, p_plan_id, p_plan_on, auth.uid())
    returning id into v_session;
  end if;

  -- The shared list comes from the others; a template only when starting first.
  v_workout := public.start_workout(
    v_plan.training_type_id, null,
    case when exists (select 1 from public.live_members where session_id = v_session)
         then null else p_template_id end);
  update public.workouts set focus_id = coalesce(focus_id, v_plan.focus_id) where id = v_workout.id;
  perform private.live_attach(v_session, v_workout.id);
  return v_workout.id;
end;
$$;

-- "Nur für mich": called with the new exercise's id before it is added.
create function public.live_keep_private(p_item_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.live_private_items (item_id, user_id)
  values (p_item_id, (select auth.uid()))
  on conflict (item_id) do nothing;
$$;

-- Today's plan dates of others I take part in, and whether they already train.
create function public.live_today(p_today date)
returns table (
  plan_id uuid,
  plan_on date,
  owner_id uuid,
  start_time time,
  training_type_id uuid,
  type_name text,
  type_icon text,
  focus_name text,
  session_id uuid,
  member_ids uuid[],
  my_workout_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.plan_id, o.plan_date, o.user_id, o.start_time, o.training_type_id, o.type_name,
         o.type_icon, o.focus_name, s.id,
         coalesce((select array_agg(m.user_id order by m.joined_at)
                     from public.live_members m
                     join public.workouts w on w.id = m.workout_id and w.status = 'active'
                    where m.session_id = s.id), '{}'),
         (select m.workout_id from public.live_members m
           where m.session_id = s.id and m.user_id = (select auth.uid()))
    from public.plan_participants pp
    join public.plans p on p.id = pp.plan_id and p.kind = 'training'
    cross join lateral public.plan_occurrences(p.user_id, p_today, p_today) o
    left join public.live_sessions s
      on s.plan_id = o.plan_id and s.plan_on = o.plan_date and s.ended_at is null
   where pp.user_id = (select auth.uid())
     and o.plan_id = pp.plan_id and o.status = 'planned'
     and exists (select 1 from private.live_plan_people(pp.plan_id, o.plan_date) lp
                  where lp.user_id = (select auth.uid()));
$$;

-- The others' sets for each shared exercise of my running workout.
create function public.live_peer_sets(p_workout_id uuid)
returns table (item_id uuid, user_id uuid, sets jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select mine.item_id, w.user_id,
         coalesce((select jsonb_agg(jsonb_build_object(
                      'weightKg', st.weight_kg, 'reps', st.reps,
                      'durationSeconds', st.duration_seconds, 'isWarmup', st.is_warmup)
                    order by st.position)
                     from public.workout_sets st
                    where st.item_id = other.item_id and st.completed_at is not null), '[]')
    from public.live_items mine
    join public.workouts my on my.id = mine.workout_id and my.user_id = (select auth.uid())
    join public.live_items other
      on other.session_id = mine.session_id and other.key = mine.key
     and other.workout_id <> mine.workout_id
    join public.workout_items oi on oi.id = other.item_id
    join public.workouts w on w.id = other.workout_id
   where mine.workout_id = p_workout_id;
$$;

revoke all on function public.live_start(uuid, date, uuid) from public, anon;
revoke all on function public.live_keep_private(uuid) from public, anon;
revoke all on function public.live_today(date) from public, anon;
revoke all on function public.live_peer_sets(uuid) from public, anon;
grant execute on function public.live_start(uuid, date, uuid) to authenticated;
grant execute on function public.live_keep_private(uuid) to authenticated;
grant execute on function public.live_today(date) to authenticated;
grant execute on function public.live_peer_sets(uuid) to authenticated;
