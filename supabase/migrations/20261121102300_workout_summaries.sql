-- Training module: compact summaries of finished workouts I may see (mine or shared with me),
-- for cards elsewhere (e.g. the feed). Personal module: visibility only through
-- private.can_view_user_data, no social tables.

-- Number of exercises in a workout whose best set beats the owner's best before it
-- (same rules as workout_records, but for any owner).
create function private.workout_record_count(p_workout_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  with items as (
    select i.id, i.exercise_id, i.device_id, e.measure, w.started_at, w.user_id
      from public.workout_items i
      join public.workouts w on w.id = i.workout_id
      join public.exercises e on e.id = i.exercise_id
     where w.id = p_workout_id
  ),
  this_best as (
    select it.id as item_id,
           max(private.set_score(it.measure, s.weight_kg, s.reps, s.duration_seconds)) as score
      from items it
      join public.workout_sets s on s.item_id = it.id
     where s.completed_at is not null and not s.is_warmup
     group by it.id
  ),
  before as (
    select it.id as item_id,
           max(private.set_score(it.measure, s.weight_kg, s.reps, s.duration_seconds)) as score
      from items it
      join public.workout_items oi on oi.exercise_id = it.exercise_id
      join public.workouts ow on ow.id = oi.workout_id
      join public.workout_sets s on s.item_id = oi.id
     where ow.user_id = it.user_id
       and ow.status = 'finished'
       and ow.id <> p_workout_id
       and ow.started_at < it.started_at
       and private.history_scope_matches(it.device_id, oi.device_id)
       and s.completed_at is not null and not s.is_warmup
     group by it.id
  )
  select count(*)::integer
    from this_best t
    join before b on b.item_id = t.item_id
   where t.score is not null and b.score is not null and t.score > b.score;
$$;

create function public.workout_summaries(p_workout_ids uuid[])
returns table (
  id uuid,
  user_id uuid,
  training_type_id uuid,
  type_name text,
  type_icon text,
  type_kind text,
  guided boolean,
  focus_name text,
  variant text,
  location_name text,
  started_at timestamptz,
  duration_seconds integer,
  distance_m integer,
  exercise_count integer,
  working_sets integer,
  volume_kg numeric,
  exercise_names text[],
  record_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select w.id, w.user_id, t.id, t.name, t.icon, t.kind::text, t.guided, f.name, w.variant,
         l.name, w.started_at,
         coalesce(w.duration_seconds,
                  greatest(0, extract(epoch from (w.ended_at - w.started_at))::integer
                              - w.paused_seconds)),
         w.distance_m,
         (select count(*)::integer from public.workout_items i where i.workout_id = w.id),
         (select count(*)::integer from public.workout_items i
            join public.workout_sets s on s.item_id = i.id
           where i.workout_id = w.id and s.completed_at is not null and not s.is_warmup),
         (select coalesce(sum(s.weight_kg * s.reps), 0) from public.workout_items i
            join public.workout_sets s on s.item_id = i.id
           where i.workout_id = w.id and s.completed_at is not null and not s.is_warmup),
         array(select e.name from public.workout_items i
                 join public.exercises e on e.id = i.exercise_id
                where i.workout_id = w.id order by i.position),
         private.workout_record_count(w.id)
    from public.workouts w
    join public.training_types t on t.id = w.training_type_id
    left join public.training_focuses f on f.id = w.focus_id
    left join public.locations l on l.id = w.location_id
   where w.id = any(p_workout_ids)
     and w.status = 'finished'
     and private.can_view_user_data(w.user_id, 'training');
$$;

revoke all on function private.workout_record_count(uuid) from public;
revoke all on function public.workout_summaries(uuid[]) from public, anon;
grant execute on function public.workout_summaries(uuid[]) to authenticated;
