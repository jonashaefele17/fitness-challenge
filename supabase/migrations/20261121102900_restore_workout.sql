-- Training module: "Änderungen verwerfen" while editing a finished workout. Edits are saved
-- at once; this writes back the state from when editing began. Exercises and sets keep their
-- ids, so comments and reactions on them stay attached.

create function public.restore_workout(p_workout_id uuid, p_snapshot jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_set jsonb;
  v_item_ids uuid[];
  v_set_ids uuid[];
begin
  if not exists (
    select 1 from public.workouts w
     where w.id = p_workout_id and w.user_id = auth.uid() and w.status = 'finished'
  ) then
    raise exception 'not_workout_owner' using errcode = '42501';
  end if;

  update public.workouts
     set started_at = (p_snapshot ->> 'startedAt')::timestamptz,
         ended_at = (p_snapshot ->> 'endedAt')::timestamptz,
         duration_seconds = (p_snapshot ->> 'durationSeconds')::integer,
         paused_seconds = coalesce((p_snapshot ->> 'pausedSeconds')::integer, 0),
         location_id = nullif(p_snapshot ->> 'locationId', '')::uuid,
         focus_id = nullif(p_snapshot ->> 'focusId', '')::uuid
   where id = p_workout_id;

  select coalesce(array_agg((i ->> 'id')::uuid), '{}') into v_item_ids
    from jsonb_array_elements(coalesce(p_snapshot -> 'items', '[]'::jsonb)) i;
  -- Exercises added while editing go (with their sets).
  delete from public.workout_items
   where workout_id = p_workout_id and not (id = any (v_item_ids));

  for v_item in select * from jsonb_array_elements(coalesce(p_snapshot -> 'items', '[]'::jsonb)) loop
    insert into public.workout_items (
      id, workout_id, exercise_id, device_id, position, note, rep_min, rep_max,
      target_seconds, rest_seconds, per_side, side_rest_seconds
    ) values (
      (v_item ->> 'id')::uuid, p_workout_id, (v_item ->> 'exerciseId')::uuid,
      nullif(v_item ->> 'deviceId', '')::uuid, (v_item ->> 'position')::integer,
      v_item ->> 'note', (v_item ->> 'repMin')::integer, (v_item ->> 'repMax')::integer,
      (v_item ->> 'targetSeconds')::integer, coalesce((v_item ->> 'restSeconds')::integer, 0),
      coalesce((v_item ->> 'perSide')::boolean, false),
      coalesce((v_item ->> 'sideRestSeconds')::integer, 0)
    )
    on conflict (id) do update set
      exercise_id = excluded.exercise_id, device_id = excluded.device_id,
      position = excluded.position, note = excluded.note, rep_min = excluded.rep_min,
      rep_max = excluded.rep_max, target_seconds = excluded.target_seconds,
      rest_seconds = excluded.rest_seconds, per_side = excluded.per_side,
      side_rest_seconds = excluded.side_rest_seconds
    -- Only rows of this workout (an id from elsewhere must not be taken over).
    where public.workout_items.workout_id = p_workout_id;

    select coalesce(array_agg((s ->> 'id')::uuid), '{}') into v_set_ids
      from jsonb_array_elements(coalesce(v_item -> 'sets', '[]'::jsonb)) s;
    delete from public.workout_sets
     where item_id = (v_item ->> 'id')::uuid and not (id = any (v_set_ids));

    for v_set in select * from jsonb_array_elements(coalesce(v_item -> 'sets', '[]'::jsonb)) loop
      insert into public.workout_sets (
        id, item_id, position, weight_kg, reps, duration_seconds, is_warmup, completed_at
      ) values (
        (v_set ->> 'id')::uuid, (v_item ->> 'id')::uuid, (v_set ->> 'position')::integer,
        (v_set ->> 'weightKg')::numeric, (v_set ->> 'reps')::integer,
        (v_set ->> 'durationSeconds')::integer,
        coalesce((v_set ->> 'isWarmup')::boolean, false),
        (v_set ->> 'completedAt')::timestamptz
      )
      on conflict (id) do update set
        position = excluded.position, weight_kg = excluded.weight_kg, reps = excluded.reps,
        duration_seconds = excluded.duration_seconds, is_warmup = excluded.is_warmup,
        completed_at = excluded.completed_at
      where public.workout_sets.item_id = (v_item ->> 'id')::uuid;
    end loop;
  end loop;
end;
$$;

revoke all on function public.restore_workout(uuid, jsonb) from public, anon;
grant execute on function public.restore_workout(uuid, jsonb) to authenticated;
