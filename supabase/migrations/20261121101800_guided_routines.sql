-- Guided routines (3f, Mobility player).
--
-- A routine is a template of a "guided" training type: the phone leads through it (exercise,
-- side, countdown, rest, next) instead of a set list. Per exercise: seconds per round,
-- rounds (= sets), rest afterwards and "both sides" (each round runs left, then right).
-- The workout is stored like any other (sets with duration), so it shows up everywhere.

alter table public.training_types
  add column guided boolean not null default false;
grant update (guided) on public.training_types to authenticated;

insert into public.training_types (name, kind, with_distance, sort, icon, guided)
values ('Mobility', 'exercises', false, 28, 'mobility', true);

alter table public.workout_template_items
  add column rest_seconds integer not null default 0 check (rest_seconds between 0 and 600),
  add column per_side boolean not null default false;

alter table public.workout_items
  add column target_seconds integer check (target_seconds is null or target_seconds between 1 and 3600),
  add column rest_seconds integer not null default 0 check (rest_seconds between 0 and 600),
  add column per_side boolean not null default false;
grant update (target_seconds, rest_seconds, per_side) on public.workout_items to authenticated;

-- ---------------------------------------------------------------------------
-- save_template / copy_template: carry rest and both-sides
-- ---------------------------------------------------------------------------
create or replace function public.save_template(
  p_template_id uuid,
  p_name text,
  p_training_type_id uuid,
  p_focus_id uuid,
  p_note text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := coalesce(p_template_id, gen_random_uuid());
  v_item jsonb;
  v_position integer := 0;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'template_needs_exercises' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.training_types t
     where t.id = p_training_type_id and (t.owner_id is null or t.owner_id = (select auth.uid()))
  ) then
    raise exception 'invalid_training_type' using errcode = 'P0001';
  end if;

  if p_template_id is null then
    insert into public.workout_templates (id, user_id, training_type_id, focus_id, name, note)
    values (v_id, (select auth.uid()), p_training_type_id, p_focus_id, btrim(p_name),
            nullif(btrim(coalesce(p_note, '')), ''));
  else
    update public.workout_templates
       set training_type_id = p_training_type_id, focus_id = p_focus_id, name = btrim(p_name),
           note = nullif(btrim(coalesce(p_note, '')), '')
     where id = p_template_id and user_id = (select auth.uid());
    if not found then
      raise exception 'not_template_owner' using errcode = '42501';
    end if;
    delete from public.workout_template_items where template_id = p_template_id;
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.workout_template_items (
      template_id, position, exercise_id, device_type_id, sets, warmup_sets,
      rep_min, rep_max, duration_seconds, note, rest_seconds, per_side
    ) values (
      v_id, v_position, (v_item ->> 'exerciseId')::uuid,
      nullif(v_item ->> 'deviceTypeId', '')::uuid,
      coalesce((v_item ->> 'sets')::integer, 3),
      coalesce((v_item ->> 'warmupSets')::integer, 0),
      (v_item ->> 'repMin')::integer, (v_item ->> 'repMax')::integer,
      (v_item ->> 'durationSeconds')::integer,
      nullif(btrim(coalesce(v_item ->> 'note', '')), ''),
      coalesce((v_item ->> 'restSeconds')::integer, 0),
      coalesce((v_item ->> 'perSide')::boolean, false)
    );
    v_position := v_position + 1;
  end loop;
  return v_id;
end;
$$;

create or replace function public.copy_template(p_template_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_template public.workout_templates%rowtype;
  v_items jsonb;
begin
  select * into v_template from public.workout_templates t where t.id = p_template_id;
  if not found or not private.can_view_user_data(v_template.user_id, 'training') then
    raise exception 'template_not_visible' using errcode = '42501';
  end if;
  select jsonb_agg(jsonb_build_object(
           'exerciseId', i.exercise_id, 'deviceTypeId', i.device_type_id, 'sets', i.sets,
           'warmupSets', i.warmup_sets, 'repMin', i.rep_min, 'repMax', i.rep_max,
           'durationSeconds', i.duration_seconds, 'note', i.note,
           'restSeconds', i.rest_seconds, 'perSide', i.per_side) order by i.position)
    into v_items
    from public.workout_template_items i where i.template_id = p_template_id;
  return public.save_template(
    null, v_template.name,
    -- A personal training type of someone else becomes the matching default (or Studio).
    coalesce(
      (select t.id from public.training_types t
        where t.id = v_template.training_type_id
          and (t.owner_id is null or t.owner_id = (select auth.uid()))),
      (select t.id from public.training_types t
        where t.owner_id is null and t.kind = 'exercises' order by t.sort limit 1)),
    v_template.focus_id, v_template.note, v_items);
end;
$$;

-- ---------------------------------------------------------------------------
-- start_workout: copy target time, rest and both-sides; a both-sides round is two sets
-- (left, right).
-- ---------------------------------------------------------------------------
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
        workout_id, exercise_id, device_id, position, note, rep_min, rep_max,
        target_seconds, rest_seconds, per_side
      ) values (
        v_workout.id, v_item.exercise_id,
        (select d.id from public.devices d
          where d.location_id = v_location and d.device_type_id = v_item.device_type_id),
        v_item.position, v_item.note, v_item.rep_min, v_item.rep_max,
        v_item.duration_seconds, v_item.rest_seconds, v_item.per_side)
      returning id into v_item_id;
      for v_n in 0 .. v_item.warmup_sets
                      + v_item.sets * (case when v_item.per_side then 2 else 1 end) - 1 loop
        insert into public.workout_sets (item_id, position, is_warmup)
        values (v_item_id, v_n, v_n < v_item.warmup_sets);
      end loop;
    end loop;
  end if;
  return v_workout;
end;
$$;
