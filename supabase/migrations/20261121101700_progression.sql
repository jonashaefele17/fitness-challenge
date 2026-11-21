-- Progression (3e): double progression suggestions and new bests of a workout.
--
-- Rep range per exercise in a workout (from the template at the start; editable). The
-- suggestion is computed, never stored: if last time the heaviest working sets reached the
-- top of the range, suggest the next weight step of the device (↑), else keep the weight.

alter table public.workout_items
  add column rep_min integer check (rep_min is null or rep_min between 1 and 100),
  add column rep_max integer check (rep_max is null or rep_max between 1 and 100),
  add constraint workout_items_rep_range check (rep_min is null or rep_max is null or rep_min <= rep_max);
grant update (rep_min, rep_max) on public.workout_items to authenticated;

-- start_workout: also copy the template's rep ranges.
create or replace function public.start_workout(
  p_training_type_id uuid,
  p_location_id uuid default null,
  p_template_id uuid default null
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
  v_template public.workout_templates%rowtype;
  v_item record;
  v_item_id uuid;
  v_n integer;
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
  if p_template_id is not null then
    select * into v_template from public.workout_templates t where t.id = p_template_id;
    if not found or not private.can_view_user_data(v_template.user_id, 'training') then
      raise exception 'template_not_visible' using errcode = '42501';
    end if;
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
  if v_location is not null and not private.can_view_location(v_location) then
    v_location := null;
  end if;

  insert into public.workouts (user_id, training_type_id, location_id, template_id, focus_id)
  values (auth.uid(), p_training_type_id, v_location, p_template_id, v_template.focus_id)
  returning * into v_workout;

  if p_template_id is not null then
    for v_item in
      select i.* from public.workout_template_items i
       where i.template_id = p_template_id order by i.position
    loop
      insert into public.workout_items (
        workout_id, exercise_id, device_id, position, note, rep_min, rep_max
      ) values (
        v_workout.id, v_item.exercise_id,
        (select d.id from public.devices d
          where d.location_id = v_location and d.device_type_id = v_item.device_type_id),
        v_item.position, v_item.note, v_item.rep_min, v_item.rep_max)
      returning id into v_item_id;
      for v_n in 0 .. v_item.warmup_sets + v_item.sets - 1 loop
        insert into public.workout_sets (item_id, position, is_warmup)
        values (v_item_id, v_n, v_n < v_item.warmup_sets);
      end loop;
    end loop;
  end if;
  return v_workout;
end;
$$;

-- ---------------------------------------------------------------------------
-- Suggestion for an exercise (on a device). Rep range: given, else from my most recently
-- edited template with this exercise. Based on my last workout with it (same device scope
-- preferred, like "Vorher").
-- ---------------------------------------------------------------------------
create function public.exercise_progression(
  p_exercise_id uuid,
  p_device_id uuid default null,
  p_rep_min integer default null,
  p_rep_max integer default null
)
returns table (
  rep_min integer,
  rep_max integer,
  last_weight_kg numeric,
  last_reps integer,
  step_kg numeric,
  suggested_weight_kg numeric,
  go_up boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with range as (
    select coalesce(p_rep_min, (
             select i.rep_min from public.workout_template_items i
               join public.workout_templates t on t.id = i.template_id
              where t.user_id = (select auth.uid()) and i.exercise_id = p_exercise_id
                and i.rep_max is not null
              order by t.updated_at desc limit 1)) as rep_min,
           coalesce(p_rep_max, (
             select i.rep_max from public.workout_template_items i
               join public.workout_templates t on t.id = i.template_id
              where t.user_id = (select auth.uid()) and i.exercise_id = p_exercise_id
                and i.rep_max is not null
              order by t.updated_at desc limit 1)) as rep_max
  ),
  last_item as (
    select i.id
      from public.workout_items i
      join public.workouts w on w.id = i.workout_id
     where w.user_id = (select auth.uid())
       and w.status = 'finished'
       and i.exercise_id = p_exercise_id
     order by private.history_scope_matches(p_device_id, i.device_id) desc, w.started_at desc
     limit 1
  ),
  top as (
    select max(s.weight_kg) as weight
      from public.workout_sets s
     where s.item_id = (select id from last_item)
       and s.completed_at is not null and not s.is_warmup
  ),
  top_reps as (
    select max(s.reps) as reps
      from public.workout_sets s
     where s.item_id = (select id from last_item)
       and s.completed_at is not null and not s.is_warmup
       and s.weight_kg = (select weight from top)
  ),
  step as (
    select coalesce(
             (select coalesce(d.weight_step, t.default_weight_step)
                from public.devices d join public.device_types t on t.id = d.device_type_id
               where d.id = p_device_id),
             2.5) as kg
  )
  select r.rep_min, r.rep_max, top.weight, top_reps.reps, step.kg,
         case
           when top.weight is null then null
           when r.rep_max is not null and top_reps.reps >= r.rep_max then top.weight + step.kg
           else top.weight
         end,
         coalesce(r.rep_max is not null and top_reps.reps >= r.rep_max, false)
    from range r, top, top_reps, step;
$$;

-- ---------------------------------------------------------------------------
-- New bests of one of my workouts: per exercise, the best working set (by score) when it
-- beats every earlier workout with that exercise in the same device scope.
-- ---------------------------------------------------------------------------
create function public.workout_records(p_workout_id uuid)
returns table (
  exercise_id uuid,
  weight_kg numeric,
  reps integer,
  duration_seconds integer,
  previous_weight_kg numeric,
  previous_reps integer,
  previous_duration_seconds integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with items as (
    select i.id, i.exercise_id, i.device_id, e.measure, w.started_at
      from public.workout_items i
      join public.workouts w on w.id = i.workout_id
      join public.exercises e on e.id = i.exercise_id
     where w.id = p_workout_id and w.user_id = (select auth.uid())
  ),
  this_best as (
    select distinct on (it.id) it.id as item_id, it.exercise_id, s.weight_kg, s.reps,
           s.duration_seconds,
           private.set_score(it.measure, s.weight_kg, s.reps, s.duration_seconds) as score
      from items it
      join public.workout_sets s on s.item_id = it.id
     where s.completed_at is not null and not s.is_warmup
     order by it.id, private.set_score(it.measure, s.weight_kg, s.reps, s.duration_seconds) desc nulls last
  ),
  before as (
    select distinct on (it.id) it.id as item_id, s.weight_kg, s.reps, s.duration_seconds,
           private.set_score(it.measure, s.weight_kg, s.reps, s.duration_seconds) as score
      from items it
      join public.workout_items oi on oi.exercise_id = it.exercise_id
      join public.workouts ow on ow.id = oi.workout_id
      join public.workout_sets s on s.item_id = oi.id
     where ow.user_id = (select auth.uid())
       and ow.status = 'finished'
       and ow.id <> p_workout_id
       and ow.started_at < it.started_at
       and private.history_scope_matches(it.device_id, oi.device_id)
       and s.completed_at is not null and not s.is_warmup
     order by it.id, private.set_score(it.measure, s.weight_kg, s.reps, s.duration_seconds) desc nulls last
  )
  select t.exercise_id, t.weight_kg, t.reps, t.duration_seconds, b.weight_kg, b.reps,
         b.duration_seconds
    from this_best t
    join before b on b.item_id = t.item_id
   where t.score is not null and b.score is not null and t.score > b.score;
$$;

revoke all on function public.exercise_progression(uuid, uuid, integer, integer) from public, anon;
revoke all on function public.workout_records(uuid) from public, anon;
grant execute on function public.exercise_progression(uuid, uuid, integer, integer) to authenticated;
grant execute on function public.workout_records(uuid) to authenticated;
