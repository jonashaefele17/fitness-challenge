-- Training module: add a workout afterwards ("nachtragen") and edit finished ones.
-- Personal module: no social tables here.

-- Added afterwards on purpose (not just a late finish): the social layer stays quiet.
alter table public.workouts add column logged_later boolean not null default false;

-- A finished workout for a past (or earlier today) start, optionally from a template, with
-- the duration-type details. Exercise workouts are then filled in the edit screen.
create function public.log_past_workout(
  p_training_type_id uuid,
  p_started_at timestamptz,
  p_duration_seconds integer,
  p_template_id uuid default null,
  p_distance_m integer default null,
  p_intensity smallint default null,
  p_note text default null,
  p_variant text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type public.training_types%rowtype;
  v_template public.workout_templates%rowtype;
  v_location uuid;
  v_id uuid := gen_random_uuid();
  v_item record;
  v_item_id uuid;
  v_n integer;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into v_type from public.training_types t
   where t.id = p_training_type_id and t.archived_at is null
     and (t.owner_id is null or t.owner_id = auth.uid());
  if not found then
    raise exception 'invalid_training_type' using errcode = 'P0001';
  end if;
  if p_started_at > now() or p_duration_seconds is null
     or p_duration_seconds not between 60 and 86400 then
    raise exception 'invalid_time' using errcode = 'P0001';
  end if;
  if p_template_id is not null then
    select * into v_template from public.workout_templates t where t.id = p_template_id;
    if not found or not private.can_view_user_data(v_template.user_id, 'training') then
      raise exception 'template_not_visible' using errcode = '42501';
    end if;
  end if;

  if v_type.location_mode = 'home_studio' then
    select tp.home_location_id into v_location
      from public.training_prefs tp where tp.user_id = auth.uid();
  elsif v_type.location_mode = 'private' then
    select l.id into v_location from public.locations l
     where l.owner_id = auth.uid() order by l.created_at limit 1;
  end if;

  insert into public.workouts (
    id, user_id, training_type_id, location_id, template_id, focus_id, status,
    started_at, ended_at, duration_seconds, distance_m, intensity, note, variant, logged_later
  ) values (
    v_id, auth.uid(), p_training_type_id, v_location, p_template_id, v_template.focus_id,
    'finished', p_started_at, p_started_at + make_interval(secs => p_duration_seconds),
    case when v_type.kind = 'duration' then p_duration_seconds end,
    p_distance_m, p_intensity, nullif(btrim(coalesce(p_note, '')), ''), p_variant, true
  );

  if p_template_id is not null then
    for v_item in
      select i.* from public.workout_template_items i
       where i.template_id = p_template_id order by i.position
    loop
      insert into public.workout_items (
        workout_id, exercise_id, device_id, position, note, rep_min, rep_max,
        target_seconds, rest_seconds, per_side, side_rest_seconds
      ) values (
        v_id, v_item.exercise_id,
        (select d.id from public.devices d
          where d.location_id = v_location and d.device_type_id = v_item.device_type_id),
        v_item.position, v_item.note, v_item.rep_min, v_item.rep_max,
        v_item.duration_seconds, v_item.rest_seconds, v_item.per_side, v_item.side_rest_seconds)
      returning id into v_item_id;
      for v_n in 0 .. v_item.warmup_sets
                      + v_item.sets * (case when v_item.per_side then 2 else 1 end) - 1 loop
        insert into public.workout_sets (item_id, position, is_warmup)
        values (v_item_id, v_n, v_n < v_item.warmup_sets);
      end loop;
    end loop;
  end if;
  return v_id;
end;
$$;

-- Move a finished workout of mine to another start and/or change its duration.
create function public.update_workout_time(
  p_workout_id uuid,
  p_started_at timestamptz,
  p_duration_seconds integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
begin
  if p_started_at > now() or p_duration_seconds is null
     or p_duration_seconds not between 60 and 86400 then
    raise exception 'invalid_time' using errcode = 'P0001';
  end if;
  select t.kind::text into v_kind
    from public.workouts w join public.training_types t on t.id = w.training_type_id
   where w.id = p_workout_id and w.user_id = auth.uid() and w.status = 'finished';
  if not found then
    raise exception 'not_workout_owner' using errcode = '42501';
  end if;
  update public.workouts
     set started_at = p_started_at,
         ended_at = p_started_at + make_interval(secs => p_duration_seconds),
         paused_seconds = 0,
         paused_at = null,
         duration_seconds = case when v_kind = 'duration' then p_duration_seconds end
   where id = p_workout_id;
end;
$$;

revoke all on function public.log_past_workout(uuid, timestamptz, integer, uuid, integer, smallint, text, text) from public, anon;
revoke all on function public.update_workout_time(uuid, timestamptz, integer) from public, anon;
grant execute on function public.log_past_workout(uuid, timestamptz, integer, uuid, integer, smallint, text, text) to authenticated;
grant execute on function public.update_workout_time(uuid, timestamptz, integer) to authenticated;
