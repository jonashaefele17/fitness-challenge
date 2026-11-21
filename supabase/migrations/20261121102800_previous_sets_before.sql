-- "Vorher" while editing an older workout: the sets of the workout before it (not the
-- workout itself or later ones). Without p_before it is the latest, as before.

drop function public.previous_sets(uuid, uuid);
create function public.previous_sets(
  p_exercise_id uuid,
  p_device_id uuid default null,
  p_before timestamptz default null
)
returns table (
  set_position integer,
  weight_kg numeric,
  reps integer,
  duration_seconds integer,
  is_warmup boolean,
  workout_started_at timestamptz,
  same_device boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  -- Prefer the same scope (same machine / comparable); fall back to any device of this
  -- exercise so there is at least an orientation ("other device").
  with candidates as (
    select i.id, w.started_at,
           private.history_scope_matches(p_device_id, i.device_id) as same_device
      from public.workout_items i
      join public.workouts w on w.id = i.workout_id
     where w.user_id = (select auth.uid())
       and w.status = 'finished'
       and i.exercise_id = p_exercise_id
       and (p_before is null or w.started_at < p_before)
  ),
  last_item as (
    select * from candidates
     order by same_device desc, started_at desc
     limit 1
  )
  select row_number() over (order by s.position)::integer - 1,
         s.weight_kg, s.reps, s.duration_seconds, s.is_warmup, li.started_at, li.same_device
    from last_item li
    join public.workout_sets s on s.item_id = li.id
   where s.completed_at is not null
   order by s.position;
$$;

revoke all on function public.previous_sets(uuid, uuid, timestamptz) from public, anon;
grant execute on function public.previous_sets(uuid, uuid, timestamptz) to authenticated;
