-- Save a workout as a template: also a group mate's (any workout I may see), always into a
-- template of mine. Routine settings (target time, rest, both sides, switch pause) are kept,
-- and a both-sides round (left + right = two sets) counts once.

create or replace function public.template_from_workout(
  p_workout_id uuid,
  p_name text,
  p_template_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workout public.workouts%rowtype;
  v_type_id uuid;
  v_items jsonb;
  v_name text;
begin
  select * into v_workout from public.workouts w where w.id = p_workout_id;
  if not found
     or (v_workout.user_id <> (select auth.uid())
         and not private.can_view_user_data(v_workout.user_id, 'training')) then
    raise exception 'workout_not_visible' using errcode = '42501';
  end if;

  -- Someone else's personal training type becomes the matching default (or Studio).
  v_type_id := coalesce(
    (select t.id from public.training_types t
      where t.id = v_workout.training_type_id
        and (t.owner_id is null or t.owner_id = (select auth.uid()))),
    (select t.id from public.training_types t
      where t.owner_id is null and t.kind = 'exercises' order by t.sort limit 1));

  select coalesce(jsonb_agg(item order by position), '[]'::jsonb) into v_items
    from (
      select i.position,
             jsonb_build_object(
               'exerciseId', i.exercise_id,
               'deviceTypeId', d.device_type_id,
               'sets', greatest(1, count(*) filter (where not s.is_warmup)
                                   / (case when i.per_side then 2 else 1 end)),
               'warmupSets', least(5, count(*) filter (where s.is_warmup)),
               'repMin', min(s.reps) filter (where not s.is_warmup and s.reps > 0),
               'repMax', max(s.reps) filter (where not s.is_warmup and s.reps > 0),
               'durationSeconds', coalesce(i.target_seconds,
                                           max(s.duration_seconds) filter (where not s.is_warmup)),
               'note', i.note,
               'restSeconds', i.rest_seconds,
               'perSide', i.per_side,
               'sideRestSeconds', i.side_rest_seconds
             ) as item
        from public.workout_items i
        left join public.devices d on d.id = i.device_id
        join public.workout_sets s on s.item_id = i.id and s.completed_at is not null
       where i.workout_id = p_workout_id
       group by i.id, i.position, i.exercise_id, d.device_type_id, i.note, i.target_seconds,
                i.rest_seconds, i.per_side, i.side_rest_seconds
    ) per_item;

  if p_template_id is not null then
    select t.name into v_name from public.workout_templates t
     where t.id = p_template_id and t.user_id = (select auth.uid());
    if not found then
      raise exception 'not_template_owner' using errcode = '42501';
    end if;
    return public.save_template(
      p_template_id, v_name, v_type_id,
      (select focus_id from public.workout_templates where id = p_template_id),
      (select note from public.workout_templates where id = p_template_id), v_items);
  end if;
  return public.save_template(null, p_name, v_type_id, v_workout.focus_id, null, v_items);
end;
$$;
