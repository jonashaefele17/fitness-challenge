-- Training together, after the first test (Jonas, 23.11.2026):
-- - Starting a shared plan date starts it for everyone who said yes (owner included when an
--   invitee starts); they are told ("hat euer Training gestartet"), not asked.
-- - One studio for all: the session has the starter's place; a change of place in one
--   workout changes it for all.
-- - Shared exercises are copied whole: device, sets (warm-up or working), rep range, rests,
--   sides, target time. Weights and reps are not copied (everyone lifts their own).

alter table public.live_sessions add column location_id uuid references public.locations (id) on delete set null;

-- A running workout of someone, opened from a notification.
create function private.live_workout_visible(p_target_id uuid, p_group_id uuid, p_viewer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.workouts w where w.id = p_target_id and w.user_id = p_viewer_id)
     and private.is_member(p_group_id, p_viewer_id);
$$;

insert into public.target_types (key, module, can_view_fn, owner_fn) values
  ('live_workout', 'live-training', 'private.live_workout_visible', 'private.workout_owner');

-- ---------------------------------------------------------------------------
-- A whole copy of a shared exercise
-- ---------------------------------------------------------------------------
create function private.live_copy_item(p_source public.workout_items, p_workout_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_copy uuid;
begin
  insert into public.workout_items
    (workout_id, exercise_id, device_id, position, rep_min, rep_max, target_seconds,
     rest_seconds, per_side, side_rest_seconds)
  values
    (p_workout_id, p_source.exercise_id, p_source.device_id,
     coalesce((select max(position) + 1 from public.workout_items where workout_id = p_workout_id), 0),
     p_source.rep_min, p_source.rep_max, p_source.target_seconds, p_source.rest_seconds,
     p_source.per_side, p_source.side_rest_seconds)
  returning id into v_copy;
  insert into public.workout_sets (item_id, position, is_warmup)
  select v_copy, s.position, s.is_warmup from public.workout_sets s where s.item_id = p_source.id;
  if not found then
    insert into public.workout_sets (item_id, position) values (v_copy, 0);
  end if;
  return v_copy;
end;
$$;

create or replace function private.live_share_item(p_session_id uuid, p_item public.workout_items)
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
    v_copy := private.live_copy_item(p_item, v_other);
    insert into public.live_items (item_id, session_id, workout_id, key)
    values (v_copy, p_session_id, v_other, v_key);
  end loop;
  perform set_config('app.live_propagating', 'off', true);
end;
$$;

create or replace function private.live_attach(p_session_id uuid, p_workout_id uuid)
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

  -- One studio for all.
  update public.live_sessions s
     set location_id = coalesce(s.location_id, (select location_id from public.workouts where id = p_workout_id))
   where s.id = p_session_id;
  perform set_config('app.live_propagating', 'on', true);
  update public.workouts w set location_id = s.location_id
    from public.live_sessions s
   where s.id = p_session_id and w.id = p_workout_id and s.location_id is not null
     and w.location_id is distinct from s.location_id;
  perform set_config('app.live_propagating', 'off', true);

  -- What this workout already has (e.g. from a template) is shared.
  for v_item in
    select * from public.workout_items where workout_id = p_workout_id order by position
  loop
    perform private.live_share_item(p_session_id, v_item);
  end loop;

  -- What the others share and this workout misses, copied whole, in the order of the
  -- longest-running workout.
  select m.workout_id into v_source from public.live_members m
   where m.session_id = p_session_id and m.workout_id <> p_workout_id
   order by m.joined_at limit 1;
  if v_source is null then
    return;
  end if;
  perform set_config('app.live_propagating', 'on', true);
  for v_shared in
    select distinct on (l.key) l.key, i.id as item_id
      from public.live_items l
      join public.workout_items i on i.id = l.item_id
     where l.session_id = p_session_id
       and not exists (select 1 from public.live_items mine
                        join public.workout_items mi on mi.id = mine.item_id
                       where mine.key = l.key and mi.workout_id = p_workout_id)
     order by l.key, (l.workout_id = v_source) desc, i.position
  loop
    v_copy := private.live_copy_item(
      (select i from public.workout_items i where i.id = v_shared.item_id), p_workout_id);
    insert into public.live_items (item_id, session_id, workout_id, key)
    values (v_copy, p_session_id, p_workout_id, v_shared.key);
  end loop;
  perform set_config('app.live_propagating', 'off', true);
  perform private.live_sync_order(p_session_id, v_source);
end;
$$;

-- A change of place in one workout of a session: the same place for all.
create function private.on_live_place_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session uuid;
begin
  if private.live_propagating() or new.location_id is not distinct from old.location_id then
    return null;
  end if;
  v_session := private.live_session_of(new.id);
  if v_session is null then
    return null;
  end if;
  perform set_config('app.live_propagating', 'on', true);
  update public.live_sessions set location_id = new.location_id where id = v_session;
  update public.workouts w set location_id = new.location_id
    from public.live_members m
   where m.session_id = v_session and w.id = m.workout_id and w.id <> new.id
     and w.status = 'active' and w.location_id is distinct from new.location_id;
  perform set_config('app.live_propagating', 'off', true);
  return null;
end;
$$;

create trigger workouts_after_place_live
  after update of location_id on public.workouts
  for each row execute function private.on_live_place_changed();

-- ---------------------------------------------------------------------------
-- Starting for everyone who said yes
-- ---------------------------------------------------------------------------

-- Who said yes to a plan date (the owner always), without the one starting.
create function private.live_yes_people(p_plan_id uuid, p_plan_on date)
returns table (user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select p.user_id from public.plans p where p.id = p_plan_id
  union
  select pp.user_id
    from public.plan_participants pp
    left join public.plan_responses r
      on r.plan_id = pp.plan_id and r.user_id = pp.user_id and r.on_date = p_plan_on
   where pp.plan_id = p_plan_id
     and coalesce(r.status, pp.status) = 'accepted';
$$;

-- Starts the session's workout for everyone who said yes and trains nothing else right now;
-- they are told. The owner's workout counts for the plan date.
create function private.live_start_others(p_session_id uuid, p_starter uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.live_sessions%rowtype;
  v_type uuid;
  v_focus uuid;
  v_owner uuid;
  v_person uuid;
  v_workout uuid;
begin
  select * into v_session from public.live_sessions where id = p_session_id;
  select p.user_id, p.training_type_id, p.focus_id into v_owner, v_type, v_focus
    from public.plans p where p.id = v_session.plan_id;
  -- The type the starter trains (a template may set the focus).
  select w.training_type_id, coalesce(w.focus_id, v_focus) into v_type, v_focus
    from public.live_members m join public.workouts w on w.id = m.workout_id
   where m.session_id = p_session_id and m.user_id = p_starter;

  for v_person in
    select y.user_id from private.live_yes_people(v_session.plan_id, v_session.plan_on) y
     where y.user_id <> p_starter
       and private.is_member(v_session.group_id, y.user_id)
       and not exists (select 1 from public.workouts w
                        where w.user_id = y.user_id and w.status = 'active')
  loop
    insert into public.workouts (user_id, training_type_id, location_id, focus_id, plan_id, plan_on)
    values (v_person, v_type, v_session.location_id, v_focus,
            case when v_person = v_owner then v_session.plan_id end,
            case when v_person = v_owner then v_session.plan_on end)
    returning id into v_workout;
    perform private.live_attach(p_session_id, v_workout);
    insert into public.notifications
      (recipient_id, group_id, category, event, actor_id, target_type, target_id, data)
    values (v_person, v_session.group_id, 'appointments', 'live_started', p_starter,
            'live_workout', v_workout,
            jsonb_build_object('preview', private.plan_preview(v_session.plan_id, v_session.plan_on)));
  end loop;
end;
$$;

-- The owner starts the plan date (training's start_workout with a plan).
create or replace function private.on_live_workout_started()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session uuid;
  v_group uuid;
  v_new boolean := false;
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
    insert into public.live_sessions (group_id, plan_id, plan_on, started_by, location_id)
    values (v_group, new.plan_id, new.plan_on, new.user_id, new.location_id)
    returning id into v_session;
    v_new := true;
  end if;
  perform private.live_attach(v_session, new.id);
  if v_new then
    perform private.live_start_others(v_session, new.user_id);
  end if;
  return null;
end;
$$;

-- Someone invited starts (or joins) a plan date of someone else.
create or replace function public.live_start(p_plan_id uuid, p_plan_on date, p_template_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.plans%rowtype;
  v_group uuid;
  v_session uuid;
  v_new boolean := false;
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
  -- Already started for me (someone else started it): that workout.
  if v_session is not null then
    select w.* into v_workout from public.live_members m
      join public.workouts w on w.id = m.workout_id and w.status = 'active'
     where m.session_id = v_session and m.user_id = auth.uid();
    if found then
      return v_workout.id;
    end if;
  end if;
  if v_session is null then
    insert into public.live_sessions (group_id, plan_id, plan_on, started_by)
    values (v_group, p_plan_id, p_plan_on, auth.uid())
    returning id into v_session;
    v_new := true;
  end if;

  -- The shared list comes from the others; a template only when starting first.
  v_workout := public.start_workout(
    v_plan.training_type_id,
    (select location_id from public.live_sessions where id = v_session),
    case when v_new then p_template_id end);
  update public.workouts set focus_id = coalesce(focus_id, v_plan.focus_id) where id = v_workout.id;
  perform private.live_attach(v_session, v_workout.id);
  if v_new then
    perform private.live_start_others(v_session, auth.uid());
  end if;
  return v_workout.id;
end;
$$;
