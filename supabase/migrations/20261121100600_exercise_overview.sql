-- Exercise picker support:
-- 1. exercise_overview(): my history per exercise in one call (last time, last best set and
--    the last six best values), scoped like previous_sets: per machine, or one shared scope
--    for no device / comparable devices (scope_device_id null).
-- 2. Anyone may link exercises to devices at public studios (devices stay editable only by
--    their creator / the super admin). Private places stay owner-only.

create function public.exercise_overview()
returns table (
  exercise_id uuid,
  scope_device_id uuid,
  last_done_at timestamptz,
  last_weight_kg numeric,
  last_reps integer,
  last_duration_seconds integer,
  trend numeric[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  with per_set as (
    select i.exercise_id,
           case when d.id is not null and not d.comparable then d.id end as scope_device_id,
           w.id as workout_id,
           w.started_at,
           s.weight_kg,
           s.reps,
           s.duration_seconds,
           case e.measure
             when 'weight_reps' then s.weight_kg
             when 'reps' then s.reps::numeric
             else s.duration_seconds::numeric
           end as value
      from public.workout_items i
      join public.workouts w on w.id = i.workout_id
      join public.exercises e on e.id = i.exercise_id
      join public.workout_sets s on s.item_id = i.id
      left join public.devices d on d.id = i.device_id
     where w.user_id = (select auth.uid())
       and w.status = 'finished'
       and s.completed_at is not null
       and not s.is_warmup
  ),
  best_per_workout as (
    select distinct on (exercise_id, scope_device_id, workout_id)
           exercise_id, scope_device_id, workout_id, started_at, value,
           weight_kg, reps, duration_seconds
      from per_set
     order by exercise_id, scope_device_id, workout_id, value desc nulls last, reps desc nulls last
  ),
  ranked as (
    select *,
           row_number() over (
             partition by exercise_id, scope_device_id order by started_at desc
           ) as rn
      from best_per_workout
  )
  select exercise_id,
         scope_device_id,
         max(started_at) filter (where rn = 1),
         max(weight_kg) filter (where rn = 1),
         max(reps) filter (where rn = 1),
         max(duration_seconds) filter (where rn = 1),
         array_agg(value order by started_at) filter (where rn <= 6)
    from ranked
   group by exercise_id, scope_device_id;
$$;

revoke all on function public.exercise_overview() from public, anon;
grant execute on function public.exercise_overview() to authenticated;

-- Linking exercises: device editors, or anyone for devices at public studios.
drop policy "device_exercises: device editors manage" on public.device_exercises;
create policy "device_exercises: editors or public studios" on public.device_exercises
  for insert to authenticated
  with check (
    private.can_edit_device(device_id)
    or exists (
      select 1 from public.devices d
        join public.locations l on l.id = d.location_id
       where d.id = device_id and l.owner_id is null
    )
  );
