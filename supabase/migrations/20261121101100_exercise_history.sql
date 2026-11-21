-- Exercise history: progress per workout, volume and records (computed, never stored).
--
-- A set's score ranks sets of one exercise:
--   weight_reps: estimated one-rep max (Epley: kg × (1 + reps / 30); a single rep is its kg),
--                so 40 kg × 10 beats 40 kg × 8 (double progression shows as progress)
--   reps:        repetitions
--   duration:    seconds
-- The score only orders and draws; the app always shows the real set (42,5 kg × 10).

create function private.set_score(
  p_measure public.exercise_measure,
  p_weight_kg numeric,
  p_reps integer,
  p_duration_seconds integer
)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case p_measure
    when 'weight_reps' then
      case
        when p_weight_kg is null or p_reps is null or p_reps < 1 then null
        when p_reps = 1 then p_weight_kg
        else round(p_weight_kg * (1 + p_reps / 30.0), 2)
      end
    when 'reps' then p_reps::numeric
    else p_duration_seconds::numeric
  end;
$$;

-- The card's mini line and the picker's "zuletzt" use the score from now on.
create or replace function public.exercise_trend(
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
           max(private.set_score(e.measure, s.weight_kg, s.reps, s.duration_seconds)) as value
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
  select started_at, value from per_workout where value is not null order by started_at;
$$;

create or replace function public.exercise_overview()
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
           case when d.id is not null and not t.comparable then d.id end as scope_device_id,
           w.id as workout_id,
           w.started_at,
           s.weight_kg,
           s.reps,
           s.duration_seconds,
           private.set_score(e.measure, s.weight_kg, s.reps, s.duration_seconds) as value
      from public.workout_items i
      join public.workouts w on w.id = i.workout_id
      join public.exercises e on e.id = i.exercise_id
      join public.workout_sets s on s.item_id = i.id
      left join public.devices d on d.id = i.device_id
      left join public.device_types t on t.id = d.device_type_id
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
     order by exercise_id, scope_device_id, workout_id, value desc nulls last, weight_kg desc nulls last
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
         array_agg(value order by started_at) filter (where rn <= 6 and value is not null)
    from ranked
   group by exercise_id, scope_device_id;
$$;

-- Every ticked set of my finished workouts for one exercise, in a device scope:
-- the machine (or the shared scope of comparable devices / no device), or all devices.
create function private.exercise_sets(
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
   where w.user_id = (select auth.uid())
     and w.status = 'finished'
     and i.exercise_id = p_exercise_id
     and s.completed_at is not null
     and (p_all_devices or private.history_scope_matches(p_device_id, i.device_id));
$$;

/** One row per workout: best set (by score), volume of working sets, all sets. */
create function public.exercise_sessions(
  p_exercise_id uuid,
  p_device_id uuid default null,
  p_all_devices boolean default false
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
    select * from private.exercise_sets(p_exercise_id, p_device_id, p_all_devices)
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

/**
 * Records in a scope: best (highest score), heaviest (most kg, then reps), volume (most in
 * one workout) and, per weight, the most reps ("40 kg: 12 Wdh.") - always the first time.
 */
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
    select * from private.exercise_sets(p_exercise_id, p_device_id, p_all_devices) x
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
grant execute on function private.set_score(public.exercise_measure, numeric, integer, integer)
  to authenticated;
grant execute on function private.exercise_sets(uuid, uuid, boolean) to authenticated;
revoke all on function public.exercise_sessions(uuid, uuid, boolean) from public, anon;
revoke all on function public.exercise_records(uuid, uuid, boolean) from public, anon;
grant execute on function public.exercise_sessions(uuid, uuid, boolean) to authenticated;
grant execute on function public.exercise_records(uuid, uuid, boolean) to authenticated;
