-- Exercise sessions of another person (for comparison): optional p_user_id, default me.
-- Visibility needs no extra check: RLS on workouts / items / sets only returns what
-- private.can_view_user_data allows (e.g. group mates), so this stays a personal function.

drop function public.exercise_sessions(uuid, uuid, boolean);
drop function public.exercise_records(uuid, uuid, boolean);
drop function private.exercise_sets(uuid, uuid, boolean);

create function private.exercise_sets(
  p_user_id uuid,
  p_exercise_id uuid,
  p_device_id uuid,
  p_all_devices boolean
)
returns table (
  workout_id uuid,
  started_at timestamptz,
  location_name text,
  device_name text,
  measure public.exercise_measure,
  item_position integer,
  set_position integer,
  weight_kg numeric,
  reps integer,
  duration_seconds integer,
  is_warmup boolean,
  score numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select w.id, w.started_at, l.name, t.name, e.measure, i.position, s.position,
         s.weight_kg, s.reps, s.duration_seconds, s.is_warmup,
         private.set_score(e.measure, s.weight_kg, s.reps, s.duration_seconds)
    from public.workout_items i
    join public.workouts w on w.id = i.workout_id
    join public.exercises e on e.id = i.exercise_id
    join public.workout_sets s on s.item_id = i.id
    left join public.locations l on l.id = w.location_id
    left join public.devices d on d.id = i.device_id
    left join public.device_types t on t.id = d.device_type_id
   where w.user_id = coalesce(p_user_id, (select auth.uid()))
     and w.status = 'finished'
     and i.exercise_id = p_exercise_id
     and s.completed_at is not null
     and (p_all_devices or private.history_scope_matches(p_device_id, i.device_id));
$$;

create function public.exercise_sessions(
  p_exercise_id uuid,
  p_device_id uuid default null,
  p_all_devices boolean default false,
  p_user_id uuid default null
)
returns table (
  workout_id uuid,
  started_at timestamptz,
  location_name text,
  device_name text,
  best_weight_kg numeric,
  best_reps integer,
  best_duration_seconds integer,
  best_score numeric,
  volume_kg numeric,
  sets jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  with sets as (
    select * from private.exercise_sets(p_user_id, p_exercise_id, p_device_id, p_all_devices)
  ),
  best as (
    select distinct on (x.workout_id) x.workout_id, x.weight_kg, x.reps, x.duration_seconds,
           x.score
      from sets x
     where not x.is_warmup and x.score is not null
     order by x.workout_id, x.score desc, x.weight_kg desc nulls last
  )
  select s.workout_id,
         s.started_at,
         max(s.location_name),
         max(s.device_name),
         b.weight_kg,
         b.reps,
         b.duration_seconds,
         b.score,
         sum(s.weight_kg * s.reps) filter (where not s.is_warmup and s.measure = 'weight_reps'),
         jsonb_agg(
           jsonb_build_object(
             'weightKg', s.weight_kg,
             'reps', s.reps,
             'durationSeconds', s.duration_seconds,
             'isWarmup', s.is_warmup
           ) order by s.item_position, s.set_position
         )
    from sets s
    left join best b on b.workout_id = s.workout_id
   group by s.workout_id, s.started_at, b.weight_kg, b.reps, b.duration_seconds, b.score
   order by s.started_at desc;
$$;

create function public.exercise_records(
  p_exercise_id uuid,
  p_device_id uuid default null,
  p_all_devices boolean default false
)
returns table (
  kind text,
  weight_kg numeric,
  reps integer,
  duration_seconds integer,
  value numeric,
  achieved_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with sets as (
    select * from private.exercise_sets(null, p_exercise_id, p_device_id, p_all_devices) x
     where not x.is_warmup and x.score is not null
  ),
  best as (
    select 'best'::text, x.weight_kg, x.reps, x.duration_seconds, x.score, x.started_at
      from sets x order by x.score desc, x.started_at limit 1
  ),
  heaviest as (
    select 'heaviest'::text, x.weight_kg, x.reps, x.duration_seconds, x.weight_kg, x.started_at
      from sets x where x.measure = 'weight_reps' and x.weight_kg is not null
     order by x.weight_kg desc, x.reps desc, x.started_at limit 1
  ),
  volume as (
    select 'volume'::text, null::numeric, null::integer, null::integer,
           sum(x.weight_kg * x.reps), x.started_at
      from sets x where x.measure = 'weight_reps'
     group by x.workout_id, x.started_at
     order by sum(x.weight_kg * x.reps) desc, x.started_at limit 1
  ),
  reps_at_weight as (
    select distinct on (x.weight_kg)
           'reps_at_weight'::text, x.weight_kg, x.reps, x.duration_seconds, x.reps::numeric,
           x.started_at
      from sets x where x.measure = 'weight_reps' and x.weight_kg is not null
     order by x.weight_kg, x.reps desc, x.started_at
  )
  select * from best
  union all select * from heaviest
  union all select * from volume
  union all select * from reps_at_weight;
$$;

revoke all on all functions in schema private from public;
grant execute on function private.exercise_sets(uuid, uuid, uuid, boolean) to authenticated;
revoke all on function public.exercise_sessions(uuid, uuid, boolean, uuid) from public, anon;
revoke all on function public.exercise_records(uuid, uuid, boolean) from public, anon;
grant execute on function public.exercise_sessions(uuid, uuid, boolean, uuid) to authenticated;
grant execute on function public.exercise_records(uuid, uuid, boolean) to authenticated;
