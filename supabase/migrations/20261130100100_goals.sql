-- Baustein 8a (goals, personal): personal goals. Work without any group or season (rule 13).
--
--   goal_metrics:  what a goal can measure, as data (rule 5). Read-only for clients; how a
--                  metric is computed lives in private.goal_figures / goal_history (a new
--                  metric is a row plus a branch there, no app change).
--   goals:         a person's goal: metric, its reference (exercise / habit / measurement
--                  kind), period, start value, visibility; archived instead of deleted.
--   goal_versions: minimum goal ("Mindestziel") and target from a day on (rule 7): the past
--                  is judged by the rule valid then.
-- Everything else is computed (rule 6) from the training, body and habit data in SQL (rule
-- 14): current value, progress, the line from start to target, status.
--
-- Access: the tables are the owner's only; writing through create_goal / update_goal /
-- archive_goal, which ask private.can_edit_goal (the one place a season can later lock a
-- goal or let an admin correct it). Others read shared goals only through goal_progress /
-- goal_history, asked through private.can_view_user_data(owner, 'goals') – never groups
-- directly – with kg / cm masked as the body module shares them. Nothing here references
-- social tables.

-- ---------------------------------------------------------------------------
-- Metrics (global data)
-- ---------------------------------------------------------------------------
create table public.goal_metrics (
  key text primary key check (key ~ '^[a-z][a-z_]*$'),
  label text not null,
  -- One sentence for the goal editor: what is measured.
  description text not null,
  -- level: a value that moves from a start to a target (weight 85 → 80)
  -- rate:  how often, judged per week or day (3 trainings a week, a habit on 90 % of days)
  kind text not null check (kind in ('level', 'rate')),
  -- What the goal points at: an exercise, a habit, a body measurement kind, or nothing.
  reference text check (reference in ('exercise', 'habit', 'measurement')),
  -- Unit code of the values: kg | cm | reps | seconds | percent | per_week;
  -- null: from the reference (exercise measure, measurement kind).
  unit text,
  sort smallint not null
);

insert into public.goal_metrics (key, label, description, kind, reference, unit, sort) values
  ('trainings_per_week', 'Trainings pro Woche',
   'Wie oft du pro Woche trainierst. Jede Woche zählt für sich, Pausen verkleinern sie.',
   'rate', null, 'per_week', 10),
  ('body_weight', 'Körpergewicht',
   'Dein Gewicht als Durchschnitt über 7 Tage.',
   'level', null, 'kg', 20),
  ('exercise_best', 'Bestwert an einer Übung',
   'Dein bester Satz seit dem Start – gewertet wie bei den Rekorden.',
   'level', 'exercise', null, 30),
  ('habit_rate', 'Habit-Quote',
   'An wie viel Prozent der Tage (oder Wochen) du ein Habit schaffst.',
   'rate', 'habit', 'percent', 40),
  ('body_measurement', 'Körpermaß',
   'Ein Maß aus deinem Zwischenstand, z. B. Bauchumfang.',
   'level', 'measurement', null, 50);

-- ---------------------------------------------------------------------------
-- Goals and their versions
-- ---------------------------------------------------------------------------
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  metric text not null references public.goal_metrics (key),
  -- References (which one is set follows goal_metrics.reference; checked on saving).
  exercise_id uuid references public.exercises (id),
  -- Optional with an exercise: only sets on this device (its history scope); null: all.
  device_id uuid references public.devices (id) on delete set null,
  habit_id uuid references public.habits (id) on delete cascade,
  measurement_kind text references public.body_measurement_kinds (key),
  -- Weight exercises: the values are kg at this many reps (a set at other reps counts
  -- converted with the records' formula).
  reps smallint check (reps between 1 and 50),
  starts_on date not null,
  ends_on date not null,
  -- Levels: where the line starts. Rates: the baseline before (shown only; may be null).
  start_value numeric(8, 2),
  visibility text not null default 'private' check (visibility in ('private', 'shared')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on > starts_on)
);
create index goals_user_idx on public.goals (user_id);
create index goals_habit_idx on public.goals (habit_id);

create trigger goals_set_updated_at
  before update on public.goals
  for each row execute function private.set_updated_at();

create table public.goal_versions (
  goal_id uuid not null references public.goals (id) on delete cascade,
  valid_from date not null,
  -- What the person commits to; null: a plain goal (two-step status).
  min_value numeric(8, 2),
  target_value numeric(8, 2) not null,
  created_at timestamptz not null default now(),
  primary key (goal_id, valid_from)
);

alter table public.goal_metrics enable row level security;
alter table public.goals enable row level security;
alter table public.goal_versions enable row level security;
revoke all on public.goal_metrics, public.goals, public.goal_versions from anon, authenticated;
-- Reading the tables: the owner only (others get masked figures through the functions).
-- Writing only through the functions below.
grant select on public.goal_metrics, public.goals, public.goal_versions to authenticated;

create policy "goal_metrics: everyone reads" on public.goal_metrics
  for select to authenticated using (true);
create policy "goals: own" on public.goals
  for select to authenticated using (user_id = (select auth.uid()));
create policy "goal_versions: own goal" on public.goal_versions
  for select to authenticated
  using (exists (select 1 from public.goals g
                  where g.id = goal_id and g.user_id = (select auth.uid())));

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Who may change a goal. Now: its owner. A season (8b) can narrow this (locked from the
-- season start) and widen it (admin corrections) here, in one place.
create function private.can_edit_goal(p_goal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.goals g
                  where g.id = p_goal_id and g.user_id = (select auth.uid()));
$$;

-- Whether the current user may read a goal at all: mine, or shared (not archived) with
-- someone the interface function lets see my data.
create function private.can_view_goal(p_owner uuid, p_visibility text, p_archived_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_owner = (select auth.uid())
      or (p_visibility = 'shared' and p_archived_at is null
          and private.can_view_user_data(p_owner, 'goals'));
$$;

-- Whether kg / cm of a goal are hidden from the current user: weight only as far as the
-- owner shares the weight in kg (body module's weight_view), body measurements never (they
-- are not shared at all). Progress in % and the status stay visible.
create function private.goal_values_hidden(p_owner uuid, p_metric text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_owner <> (select auth.uid())
     and case p_metric
           when 'body_weight' then coalesce(private.weight_view(p_owner) not in ('kg', 'days'), true)
           when 'body_measurement' then true
           else false
         end;
$$;

-- The version valid on a day: the latest from that day or before; before the first one,
-- the first one.
create function private.goal_version_at(p_goal_id uuid, p_on date)
returns public.goal_versions
language sql
stable
security definer
set search_path = ''
as $$
  select v.* from public.goal_versions v
   where v.goal_id = p_goal_id
   order by case when v.valid_from <= p_on then v.valid_from end desc nulls last, v.valid_from
   limit 1;
$$;

-- Unit code of a goal's values: kg | cm | reps | seconds | percent | per_week.
create function private.goal_unit(p_metric text, p_exercise_id uuid, p_measurement_kind text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select m.unit from public.goal_metrics m where m.key = p_metric),
    (select case e.measure when 'weight_reps' then 'kg' when 'reps' then 'reps' else 'seconds' end
       from public.exercises e where e.id = p_exercise_id),
    (select k.unit from public.body_measurement_kinds k where k.key = p_measurement_kind));
$$;

-- ---------------------------------------------------------------------------
-- Building blocks over the other personal modules (no access check: callers check)
-- ---------------------------------------------------------------------------

-- Trainings per ISO week over a range: only the days inside the range count. free_days:
-- days not paused (habit pauses); done: days with a finished training that are not paused
-- (a day counts once, like the habit "Sport").
create function private.training_weeks(p_user_id uuid, p_from date, p_to date, p_time_zone text)
returns table (
  week_start date,
  week_end date,
  free_days integer,
  done integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with trained as (
    select distinct (w.started_at at time zone p_time_zone)::date as on_date
      from public.workouts w
     where w.user_id = p_user_id
       and w.status = 'finished'
       and w.started_at >= p_from - 1
       and w.started_at < p_to + 2
  ),
  days as (
    select d::date as on_date,
           exists (select 1 from public.habit_pauses p
                    where p.user_id = p_user_id and d::date between p.from_date and p.to_date)
             as paused
      from generate_series(p_from, p_to, interval '1 day') d
  )
  select date_trunc('week', d.on_date::timestamp)::date,
         max(d.on_date),
         count(*) filter (where not d.paused)::integer,
         count(*) filter (where not d.paused
                            and exists (select 1 from trained t where t.on_date = d.on_date))::integer
    from days d
   group by date_trunc('week', d.on_date::timestamp)
   order by 1;
$$;

-- The weeks of a trainings-per-week goal up to the current one, each judged on its own with
-- the version valid on its last day. Minimum and target shrink with the free days exactly as
-- a weekly habit's target does (private.habit_week_target).
--   state: paused (no free day) · open (not over and target not yet reached) ·
--          target_reached · min_reached · below_min (with a minimum) · not_reached
create function private.goal_training_weeks(p_goal public.goals, p_today date, p_time_zone text)
returns table (
  week_start date,
  week_end date,
  free_days integer,
  done integer,
  min_needed integer,
  target_needed integer,
  finished boolean,
  state text
)
language sql
stable
security definer
set search_path = ''
as $$
  select w.week_start, w.week_end, w.free_days, w.done,
         private.habit_week_target(v.min_value, w.free_days),
         private.habit_week_target(v.target_value, w.free_days),
         w.week_end < p_today,
         case
           when w.free_days = 0 then 'paused'
           when w.done >= private.habit_week_target(v.target_value, w.free_days) then 'target_reached'
           when w.week_end >= p_today then 'open'
           when v.min_value is null then 'not_reached'
           when w.done >= private.habit_week_target(v.min_value, w.free_days) then 'min_reached'
           else 'below_min'
         end
    from private.training_weeks(
           p_goal.user_id,
           p_goal.starts_on,
           least(p_goal.ends_on, (date_trunc('week', p_today::timestamp) + interval '6 days')::date),
           p_time_zone) w
   cross join lateral private.goal_version_at(p_goal.id, w.week_end) v
   order by w.week_start;
$$;

-- How far a habit was met over a range, exactly as habit_stats counts its quota: daily
-- habits the mean score of the days answered or missed (partly met counts partly; pauses,
-- days not due and open days do not count); weekly habits the share of the weeks met out
-- of the weeks that ended (pauses and the running week do not count). The habit's
-- frequency on the last day decides which.
create function private.goal_habit_quota(
  p_user_id uuid,
  p_habit_id uuid,
  p_from date,
  p_to date,
  p_today date,
  p_time_zone text
)
returns table (
  counted integer,
  met integer,
  quota_pct numeric,
  count_unit text
)
language sql
stable
security definer
set search_path = ''
as $$
  with freq as (
    select v.frequency from public.habit_versions v
     where v.habit_id = p_habit_id
     order by case when v.valid_from <= p_to then v.valid_from end desc nulls last, v.valid_from
     limit 1
  ),
  days as (
    select d.state, least(coalesce(d.score, 0), 1) as score
      from private.habit_days_judged(p_user_id, p_from, p_to, p_today, p_time_zone) d
     where p_from <= p_to
       and d.habit_id = p_habit_id
       and d.frequency <> 'weekly'
       and d.state in ('done', 'partial', 'missed')
  ),
  weeks as (
    select w.state
      from private.habit_weeks_judged(p_user_id, p_from, p_to, p_today, p_time_zone) w
     where p_from <= p_to
       and w.habit_id = p_habit_id
       and w.state in ('done', 'missed')
       and w.week_start between date_trunc('week', p_from::timestamp)::date and p_to
  )
  select case when f.frequency = 'weekly' then (select count(*)::integer from weeks)
              else (select count(*)::integer from days) end,
         case when f.frequency = 'weekly' then (select count(*) filter (where state = 'done')::integer from weeks)
              else (select count(*) filter (where state = 'done')::integer from days) end,
         case when f.frequency = 'weekly'
              then (select round(avg(case when state = 'done' then 1 else 0 end) * 100, 1) from weeks)
              else (select round(avg(score) * 100, 1) from days) end,
         case when f.frequency = 'weekly' then 'weeks' else 'days' end
    from freq f;
$$;

-- An exercise's best set per local day in a range, ranked as the records rank sets
-- (private.set_score: weight exercises by kg × reps^0.1, others by reps or seconds; warm-up
-- sets do not count). value: weight exercises in kg at p_reps reps (kg × (reps / p_reps)^0.1,
-- the same order as the score; a set at exactly p_reps reps is its weight), otherwise reps
-- or seconds. p_device_id: only that device's history scope; null: all devices.
create function private.goal_exercise_days(
  p_user_id uuid,
  p_exercise_id uuid,
  p_device_id uuid,
  p_reps integer,
  p_from date,
  p_to date,
  p_time_zone text
)
returns table (
  on_date date,
  value numeric,
  weight_kg numeric,
  reps integer,
  duration_seconds integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with s as (
    select (x.started_at at time zone p_time_zone)::date as on_date, x.started_at,
           x.weight_kg, x.reps, x.duration_seconds,
           case x.measure
             when 'weight_reps' then round(x.weight_kg * power(x.reps::numeric / coalesce(p_reps, 1), 0.1), 2)
             when 'reps' then x.reps::numeric
             else x.duration_seconds::numeric
           end as value
      from private.exercise_sets(p_user_id, p_exercise_id, p_device_id, p_device_id is null) x
     where not x.is_warmup and x.score is not null
  )
  select distinct on (s.on_date) s.on_date, s.value, s.weight_kg, s.reps, s.duration_seconds
    from s
   where s.on_date between p_from and p_to
   order by s.on_date, s.value desc, s.started_at;
$$;

-- ---------------------------------------------------------------------------
-- The figures of a goal (no access check: callers check and mask)
-- ---------------------------------------------------------------------------
--   evaluated_on: today, or the last day once the goal is over (values then stay frozen)
--   phase: upcoming (starts later) · running · ended
--   min_value / target_value: the version valid on evaluated_on
--   Levels (weight, exercise, measurement):
--     current_value: weight – the 7-day trend of the latest day weighed since the start;
--       exercise – the best set since the start; measurement – the latest check-in value
--       since the start (null: nothing since the start)
--     progress_pct: how far from start to target, (current − start) / (target − start)
--       × 100 – works both ways (85 → 80 kg: 82.5 kg is 50 %); may be below 0 or above 100
--     expected_value: where the straight line from start (first day) to target (last day)
--       is on evaluated_on; on_track: current is at or beyond it (in the target's direction)
--     status: target_reached · min_reached · below_min (with a minimum) · not_reached
--   Trainings per week (rate): finished weeks are judged on their own (see
--     goal_training_weeks); fully paused weeks drop out.
--     counted: judged weeks · min_met / target_met: of them, reaching min / target
--     current_value: average trainings per judged week
--     progress_pct: trainings in the judged weeks / trainings the target asked for in them
--     status / on_track: those totals against what min and target asked for (one weak
--       week can be made up later)
--     week_done / week_min / week_target: the running week so far
--   Habit quota (rate): counted / target_met: days (or weeks) counted and fully met;
--     current_value: the quota in % since the start (as habit_stats counts it);
--     progress_pct: current / target × 100; status against min and target; on_track:
--     at or above the minimum (or the target without one)
create function private.goal_figures(p_goal public.goals, p_today date, p_time_zone text)
returns table (
  evaluated_on date,
  phase text,
  min_value numeric,
  target_value numeric,
  current_value numeric,
  current_on date,
  expected_value numeric,
  progress_pct numeric,
  status text,
  on_track boolean,
  counted integer,
  min_met integer,
  target_met integer,
  count_unit text,
  week_done integer,
  week_min integer,
  week_target integer,
  best_weight_kg numeric,
  best_reps integer,
  best_duration_seconds integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  g public.goals := p_goal;
  v_eval date := least(p_today, p_goal.ends_on);
  v_phase text := case when p_today < p_goal.starts_on then 'upcoming'
                       when p_today > p_goal.ends_on then 'ended'
                       else 'running' end;
  v_version public.goal_versions;
  v_min numeric;
  v_target numeric;
  v_cur numeric;
  v_cur_on date;
  v_expected numeric;
  v_progress numeric;
  v_status text;
  v_on_track boolean;
  v_counted integer;
  v_min_met integer;
  v_target_met integer;
  v_unit text;
  v_week_done integer;
  v_week_min integer;
  v_week_target integer;
  v_best_kg numeric;
  v_best_reps integer;
  v_best_seconds integer;
  v_dir numeric;
  v_done_total integer;
  v_min_total integer;
  v_target_total integer;
begin
  v_version := private.goal_version_at(g.id, v_eval);
  v_min := v_version.min_value;
  v_target := v_version.target_value;

  if g.metric = 'trainings_per_week' then
    select count(*) filter (where w.finished and w.state <> 'paused')::integer,
           count(*) filter (where w.finished and w.state <> 'paused' and w.done >= w.min_needed)::integer,
           count(*) filter (where w.finished and w.state = 'target_reached')::integer,
           coalesce(sum(w.done) filter (where w.finished and w.state <> 'paused'), 0)::integer,
           coalesce(sum(w.min_needed) filter (where w.finished and w.state <> 'paused'), 0)::integer,
           coalesce(sum(w.target_needed) filter (where w.finished and w.state <> 'paused'), 0)::integer,
           max(w.done) filter (where not w.finished),
           max(w.min_needed) filter (where not w.finished),
           max(w.target_needed) filter (where not w.finished)
      into v_counted, v_min_met, v_target_met, v_done_total, v_min_total, v_target_total,
           v_week_done, v_week_min, v_week_target
      from private.goal_training_weeks(g, p_today, p_time_zone) w;
    v_unit := 'weeks';
    if v_min is null then
      v_min_met := null;
    end if;
    if v_counted > 0 then
      v_cur := round(v_done_total::numeric / v_counted, 1);
      v_progress := round(v_done_total * 100.0 / nullif(v_target_total, 0), 1);
      v_status := case
        when v_done_total >= v_target_total then 'target_reached'
        when v_min is null then 'not_reached'
        when v_done_total >= v_min_total then 'min_reached'
        else 'below_min'
      end;
      v_on_track := v_done_total >= case when v_min is null then v_target_total else v_min_total end;
    end if;

  elsif g.metric = 'habit_rate' then
    if v_eval >= g.starts_on then
      select q.counted, q.met, q.quota_pct, q.count_unit
        into v_counted, v_target_met, v_cur, v_unit
        from private.goal_habit_quota(g.user_id, g.habit_id, g.starts_on, v_eval, p_today, p_time_zone) q;
    end if;
    if v_cur is not null then
      v_progress := round(v_cur / nullif(v_target, 0) * 100, 1);
      v_status := case
        when v_cur >= v_target then 'target_reached'
        when v_min is null then 'not_reached'
        when v_cur >= v_min then 'min_reached'
        else 'below_min'
      end;
      v_on_track := v_cur >= coalesce(v_min, v_target);
    end if;

  else
    -- Levels
    if g.metric = 'body_weight' then
      select t.trend_kg, t.on_date into v_cur, v_cur_on
        from private.weight_trend(g.user_id, g.starts_on, v_eval) t
       order by t.on_date desc limit 1;
    elsif g.metric = 'body_measurement' then
      select m.value, c.on_date into v_cur, v_cur_on
        from public.body_measurements m
        join public.body_checkins c on c.id = m.checkin_id
       where c.user_id = g.user_id and m.kind = g.measurement_kind and not c.skipped
         and c.on_date between g.starts_on and v_eval
       order by c.on_date desc limit 1;
    elsif g.metric = 'exercise_best' then
      select x.value, x.on_date, x.weight_kg, x.reps, x.duration_seconds
        into v_cur, v_cur_on, v_best_kg, v_best_reps, v_best_seconds
        from private.goal_exercise_days(g.user_id, g.exercise_id, g.device_id, g.reps,
                                        g.starts_on, v_eval, p_time_zone) x
       order by x.value desc, x.on_date limit 1;
    end if;

    v_dir := sign(v_target - g.start_value);
    v_expected := round(g.start_value + (v_target - g.start_value)
                    * least(greatest(v_eval - g.starts_on, 0), g.ends_on - g.starts_on)::numeric
                    / (g.ends_on - g.starts_on), 2);
    if v_cur is not null and v_dir <> 0 then
      v_progress := round((v_cur - g.start_value) / (v_target - g.start_value) * 100, 1);
      v_status := case
        when (v_cur - v_target) * v_dir >= 0 then 'target_reached'
        when v_min is null then 'not_reached'
        when (v_cur - v_min) * v_dir >= 0 then 'min_reached'
        else 'below_min'
      end;
      v_on_track := (v_cur - v_expected) * v_dir >= 0;
    end if;
  end if;

  return query select v_eval, v_phase, v_min, v_target, v_cur, v_cur_on, v_expected, v_progress,
                      v_status, v_on_track, v_counted, v_min_met, v_target_met, v_unit,
                      v_week_done, v_week_min, v_week_target, v_best_kg, v_best_reps,
                      v_best_seconds;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reading
-- ---------------------------------------------------------------------------

-- The goals of a person with their figures (p_user_id null: mine). Mine: all (archived ones
-- with p_include_archived); someone else's: only shared, not archived ones, and only if
-- can_view_user_data lets me see their data. p_goal_id: just that goal.
-- values_hidden: kg / cm left out for me (weight not shared in kg, body measurements): then
-- start, minimum, target, current and expected value and the best set are null, while
-- progress_pct, status and on_track stay.
create function public.goal_progress(
  p_user_id uuid default null,
  p_today date default current_date,
  p_time_zone text default 'Europe/Berlin',
  p_include_archived boolean default false,
  p_goal_id uuid default null
)
returns table (
  id uuid,
  user_id uuid,
  metric text,
  metric_label text,
  metric_kind text,
  unit text,
  exercise_id uuid,
  device_id uuid,
  habit_id uuid,
  measurement_kind text,
  reference_label text,
  reference_detail text,
  reps integer,
  starts_on date,
  ends_on date,
  visibility text,
  archived_at timestamptz,
  created_at timestamptz,
  values_hidden boolean,
  evaluated_on date,
  phase text,
  start_value numeric,
  min_value numeric,
  target_value numeric,
  current_value numeric,
  current_on date,
  expected_value numeric,
  progress_pct numeric,
  status text,
  on_track boolean,
  counted integer,
  min_met integer,
  target_met integer,
  count_unit text,
  week_done integer,
  week_min integer,
  week_target integer,
  best_weight_kg numeric,
  best_reps integer,
  best_duration_seconds integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with g as (
    select g.*, private.goal_values_hidden(g.user_id, g.metric) as hidden
      from public.goals g
     where g.user_id = coalesce(p_user_id, (select auth.uid()))
       and (p_goal_id is null or g.id = p_goal_id)
       and (g.archived_at is null or p_include_archived)
       and private.can_view_goal(g.user_id, g.visibility, g.archived_at)
  )
  select g.id, g.user_id, g.metric, m.label, m.kind,
         private.goal_unit(g.metric, g.exercise_id, g.measurement_kind),
         g.exercise_id, g.device_id, g.habit_id, g.measurement_kind,
         coalesce(e.name, hv.name, k.label),
         case when g.device_id is not null then concat_ws(' · ', dt.name, l.name) end,
         g.reps::integer, g.starts_on, g.ends_on, g.visibility, g.archived_at, g.created_at,
         g.hidden,
         f.evaluated_on, f.phase,
         case when not g.hidden then g.start_value end,
         case when not g.hidden then f.min_value end,
         case when not g.hidden then f.target_value end,
         case when not g.hidden then f.current_value end,
         f.current_on,
         case when not g.hidden then f.expected_value end,
         f.progress_pct, f.status, f.on_track, f.counted, f.min_met, f.target_met, f.count_unit,
         f.week_done, f.week_min, f.week_target,
         case when not g.hidden then f.best_weight_kg end,
         case when not g.hidden then f.best_reps end,
         case when not g.hidden then f.best_duration_seconds end
    from g
    join public.goal_metrics m on m.key = g.metric
    cross join lateral private.goal_figures(
      (select x from public.goals x where x.id = g.id), p_today, p_time_zone) f
    left join public.exercises e on e.id = g.exercise_id
    left join public.devices d on d.id = g.device_id
    left join public.device_types dt on dt.id = d.device_type_id
    left join public.locations l on l.id = d.location_id
    left join public.body_measurement_kinds k on k.key = g.measurement_kind
    left join lateral (
      select v.name from public.habit_versions v
       where v.habit_id = g.habit_id order by v.valid_from desc limit 1
    ) hv on true
   order by g.archived_at nulls first, m.sort, g.created_at;
$$;

-- A goal's course over its period up to evaluated_on, for a chart against the target line
-- (same access and masking as goal_progress; nothing for a goal I may not see).
--   Levels: one point per day with a value – weight: each day weighed (7-day trend);
--     measurement: each check-in; exercise: each training day's best set. min/target: the
--     version valid that day; expected_value: the line from start to target that day;
--     progress_pct and state (status as in goal_progress) of that value.
--   Trainings per week: one point per week (on_date: Monday): value = trainings,
--     min/target = what that week asked for (shrunk by pauses), state as in
--     goal_training_weeks, progress_pct = trainings / target of the week.
--   Habit quota: one point per week: value = the week's quota in %, min/target the goal's
--     (valid at the week's end), state target_reached · min_reached · below_min ·
--     not_reached · open (running week) · paused (nothing counted).
create function public.goal_history(
  p_goal_id uuid,
  p_today date default current_date,
  p_time_zone text default 'Europe/Berlin'
)
returns table (
  on_date date,
  value numeric,
  min_value numeric,
  target_value numeric,
  expected_value numeric,
  progress_pct numeric,
  state text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  g public.goals;
  v_eval date;
  v_hidden boolean;
begin
  select * into g from public.goals x where x.id = p_goal_id;
  if not found or not private.can_view_goal(g.user_id, g.visibility, g.archived_at) then
    return;
  end if;
  v_eval := least(p_today, g.ends_on);
  v_hidden := private.goal_values_hidden(g.user_id, g.metric);

  if g.metric = 'trainings_per_week' then
    return query
      select w.week_start, w.done::numeric, w.min_needed::numeric, w.target_needed::numeric,
             null::numeric,
             round(w.done * 100.0 / nullif(w.target_needed, 0), 1),
             w.state
        from private.goal_training_weeks(g, p_today, p_time_zone) w
       order by w.week_start;

  elsif g.metric = 'habit_rate' then
    return query
      with weeks as (
        select date_trunc('week', d::timestamp)::date as week_start,
               least(max(d::date), v_eval) as week_end
          from generate_series(g.starts_on, v_eval, interval '1 day') d
         group by 1
      ),
      quota as (
        select w.week_start, w.week_end, q.quota_pct, q.counted,
               private.goal_version_at(g.id, w.week_end) as v
          from weeks w
          cross join lateral private.goal_habit_quota(
            g.user_id, g.habit_id, greatest(w.week_start, g.starts_on), w.week_end, p_today,
            p_time_zone) q
      )
      select q.week_start, q.quota_pct, (q.v).min_value, (q.v).target_value, null::numeric,
             round(q.quota_pct / nullif((q.v).target_value, 0) * 100, 1),
             case
               when q.week_start + 6 >= p_today and coalesce(q.quota_pct < (q.v).target_value, true) then 'open'
               when q.counted = 0 then 'paused'
               when q.quota_pct >= (q.v).target_value then 'target_reached'
               when (q.v).min_value is null then 'not_reached'
               when q.quota_pct >= (q.v).min_value then 'min_reached'
               else 'below_min'
             end
        from quota q
       order by q.week_start;

  else
    return query
      with points as (
        select t.on_date, t.trend_kg as value
          from private.weight_trend(g.user_id, g.starts_on, v_eval) t
         where g.metric = 'body_weight'
        union all
        select c.on_date, m.value
          from public.body_measurements m
          join public.body_checkins c on c.id = m.checkin_id
         where g.metric = 'body_measurement'
           and c.user_id = g.user_id and m.kind = g.measurement_kind and not c.skipped
           and c.on_date between g.starts_on and v_eval
        union all
        select x.on_date, x.value
          from private.goal_exercise_days(g.user_id, g.exercise_id, g.device_id, g.reps,
                                          g.starts_on, v_eval, p_time_zone) x
         where g.metric = 'exercise_best'
      ),
      judged as (
        select p.on_date, p.value, v.min_value, v.target_value,
               sign(v.target_value - g.start_value) as dir,
               round(g.start_value + (v.target_value - g.start_value)
                 * least(greatest(p.on_date - g.starts_on, 0), g.ends_on - g.starts_on)::numeric
                 / (g.ends_on - g.starts_on), 2) as expected
          from points p
          cross join lateral private.goal_version_at(g.id, p.on_date) v
      )
      select j.on_date,
             case when not v_hidden then j.value end,
             case when not v_hidden then j.min_value end,
             case when not v_hidden then j.target_value end,
             case when not v_hidden then j.expected end,
             case when j.dir <> 0 then
               round((j.value - g.start_value) / (j.target_value - g.start_value) * 100, 1) end,
             case
               when j.dir = 0 then null
               when (j.value - j.target_value) * j.dir >= 0 then 'target_reached'
               when j.min_value is null then 'not_reached'
               when (j.value - j.min_value) * j.dir >= 0 then 'min_reached'
               else 'below_min'
             end
        from judged j
       order by j.on_date;
  end if;
end;
$$;

-- A suggested start value for a new goal of mine (one row; value null without data):
--   weight: the current 7-day trend (latest day weighed) · measurement: the latest
--   check-in value · exercise: the best set of the last 4 weeks (weight exercises in kg at
--   p_reps reps; without p_reps at that set's own reps, returned as reps) · trainings per
--   week: the average of the last 4 finished weeks (fully paused weeks left out) · habit
--   quota: the quota of the last 4 weeks (28 days up to yesterday).
-- on_date: the day the value is from (levels).
create function public.goal_start_suggestion(
  p_metric text,
  p_today date default current_date,
  p_time_zone text default 'Europe/Berlin',
  p_exercise_id uuid default null,
  p_device_id uuid default null,
  p_habit_id uuid default null,
  p_measurement_kind text default null,
  p_reps integer default null
)
returns table (
  value numeric,
  on_date date,
  reps integer,
  best_weight_kg numeric,
  best_reps integer,
  best_duration_seconds integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_week date := date_trunc('week', p_today::timestamp)::date;
  v_measure public.exercise_measure;
  v_reps integer := p_reps;
begin
  if v_user is null then
    return;
  end if;
  if p_metric = 'body_weight' then
    return query
      select t.trend_kg, t.on_date, null::integer, null::numeric, null::integer, null::integer
        from (select 1) one
        left join lateral (
          select t.trend_kg, t.on_date from private.weight_trend(v_user, null, p_today) t
           order by t.on_date desc limit 1) t on true;
  elsif p_metric = 'body_measurement' then
    return query
      select x.value, x.on_date, null::integer, null::numeric, null::integer, null::integer
        from (select 1) one
        left join lateral (
          select m.value, c.on_date
            from public.body_measurements m
            join public.body_checkins c on c.id = m.checkin_id
           where c.user_id = v_user and m.kind = p_measurement_kind and not c.skipped
             and c.on_date <= p_today
           order by c.on_date desc limit 1) x on true;
  elsif p_metric = 'exercise_best' then
    select e.measure into v_measure from public.exercises e where e.id = p_exercise_id;
    if v_measure = 'weight_reps' and v_reps is null then
      -- The best set's own reps (ranked as the records rank).
      select x.reps into v_reps
        from private.goal_exercise_days(v_user, p_exercise_id, p_device_id, 1,
                                        p_today - 27, p_today, p_time_zone) x
       order by x.value desc, x.on_date limit 1;
    end if;
    return query
      select x.value, x.on_date,
             case when v_measure = 'weight_reps' then v_reps end,
             x.weight_kg, x.reps, x.duration_seconds
        from (select 1) one
        left join lateral (
          select x.* from private.goal_exercise_days(v_user, p_exercise_id, p_device_id,
                                                     coalesce(v_reps, 1), p_today - 27, p_today,
                                                     p_time_zone) x
           order by x.value desc, x.on_date limit 1) x on true;
  elsif p_metric = 'trainings_per_week' then
    return query
      select round(avg(w.done) filter (where w.free_days > 0), 1), null::date, null::integer,
             null::numeric, null::integer, null::integer
        from private.training_weeks(v_user, v_week - 28, v_week - 1, p_time_zone) w;
  elsif p_metric = 'habit_rate' then
    return query
      select q.quota_pct, null::date, null::integer, null::numeric, null::integer, null::integer
        from (select 1) one
        left join lateral private.goal_habit_quota(
          v_user, p_habit_id, p_today - 28, p_today - 1, p_today, p_time_zone) q on true
       where exists (select 1 from public.habits h where h.id = p_habit_id and h.user_id = v_user)
          or p_habit_id is null;
  end if;
end;
$$;

-- What a goal of a metric can point at, for the goal editor (mine only):
--   exercise_best: the exercises I have done, newest first – one row for all devices and
--     one per specific (not comparable) device I used it on (detail: device · place)
--   habit_rate: my habits in use (label: the current name)
--   body_measurement: the measurement kinds in catalogue order
-- needs_reps: weight exercises (the goal needs a rep count). last_used_on: when I last did,
-- answered or measured it.
create function public.goal_reference_options(p_metric text)
returns table (
  exercise_id uuid,
  device_id uuid,
  habit_id uuid,
  measurement_kind text,
  label text,
  detail text,
  unit text,
  needs_reps boolean,
  last_used_on date
)
language sql
stable
security definer
set search_path = ''
as $$
  with used as (
    select i.exercise_id, i.device_id, max(w.started_at) as last_at
      from public.workouts w
      join public.workout_items i on i.workout_id = w.id
     where w.user_id = (select auth.uid())
       and w.status = 'finished'
       and exists (select 1 from public.workout_sets s
                    where s.item_id = i.id and s.completed_at is not null and not s.is_warmup)
     group by i.exercise_id, i.device_id
  ),
  options as (
    select u.exercise_id, null::uuid as device_id, max(u.last_at) as last_at
      from used u group by u.exercise_id
    union all
    select u.exercise_id, u.device_id, u.last_at
      from used u
     where u.device_id is not null and not coalesce(private.device_comparable(u.device_id), true)
  )
  select o.exercise_id, o.device_id, null::uuid, null::text, e.name,
         case when o.device_id is not null then concat_ws(' · ', dt.name, l.name) end,
         private.goal_unit('exercise_best', o.exercise_id, null),
         e.measure = 'weight_reps',
         o.last_at::date
    from options o
    join public.exercises e on e.id = o.exercise_id
    left join public.devices d on d.id = o.device_id
    left join public.device_types dt on dt.id = d.device_type_id
    left join public.locations l on l.id = d.location_id
   where p_metric = 'exercise_best'
  union all
  select null, null, h.id, null,
         (select v.name from public.habit_versions v where v.habit_id = h.id
           order by v.valid_from desc limit 1),
         null, 'percent', false,
         (select max(en.on_date) from public.habit_entries en where en.habit_id = h.id)
    from public.habits h
   where p_metric = 'habit_rate' and h.user_id = (select auth.uid()) and h.archived_at is null
  union all
  select null, null, null, k.key, k.label, null, k.unit, false,
         (select max(c.on_date) from public.body_measurements m
            join public.body_checkins c on c.id = m.checkin_id
           where c.user_id = (select auth.uid()) and m.kind = k.key and not c.skipped)
    from public.body_measurement_kinds k
   where p_metric = 'body_measurement'
  order by 9 desc nulls last, 5;
$$;

-- ---------------------------------------------------------------------------
-- Writing
-- ---------------------------------------------------------------------------

-- Checks minimum and target against the metric and start (raises on a bad combination):
--   levels: target ≠ start; a minimum lies from the start (inclusive: "hold") towards the
--   target (exclusive) · rates: target > 0, 0 ≤ minimum < target; habit quota ≤ 100 %,
--   trainings ≤ 7 a week (days count).
create function private.check_goal_values(
  p_metric text,
  p_start numeric,
  p_min numeric,
  p_target numeric
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_kind text;
begin
  select m.kind into v_kind from public.goal_metrics m where m.key = p_metric;
  if v_kind is null then
    raise exception 'unknown_metric' using errcode = '22023';
  end if;
  if p_target is null then
    raise exception 'target_required' using errcode = '22023';
  end if;
  if v_kind = 'level' then
    if p_start is null then
      raise exception 'start_required' using errcode = '22023';
    end if;
    if p_target = p_start then
      raise exception 'target_equals_start' using errcode = '22023';
    end if;
    if p_min is not null
       and not ((p_min - p_start) * sign(p_target - p_start) >= 0
                and (p_target - p_min) * sign(p_target - p_start) > 0) then
      raise exception 'min_not_between_start_and_target' using errcode = '22023';
    end if;
  else
    if p_target <= 0 or (p_min is not null and (p_min < 0 or p_min >= p_target)) then
      raise exception 'invalid_rate_values' using errcode = '22023';
    end if;
    if (p_metric = 'habit_rate' and p_target > 100)
       or (p_metric = 'trainings_per_week' and p_target > 7) then
      raise exception 'target_too_high' using errcode = '22023';
    end if;
  end if;
end;
$$;

-- Creates a goal of mine (p_id: the client's id) with its first version from the start
-- day. The references must fit the metric: an exercise (optionally a device; weight
-- exercises need p_reps), one of my habits, or a measurement kind. Returns the id.
create function public.create_goal(
  p_id uuid,
  p_metric text,
  p_starts_on date,
  p_ends_on date,
  p_start_value numeric,
  p_min_value numeric,
  p_target_value numeric,
  p_visibility text default 'private',
  p_exercise_id uuid default null,
  p_device_id uuid default null,
  p_habit_id uuid default null,
  p_measurement_kind text default null,
  p_reps integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_ref text;
  v_measure public.exercise_measure;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if p_starts_on is null or p_ends_on is null or p_ends_on <= p_starts_on then
    raise exception 'invalid_period' using errcode = '22023';
  end if;
  perform private.check_goal_values(p_metric, p_start_value, p_min_value, p_target_value);
  select m.reference into v_ref from public.goal_metrics m where m.key = p_metric;

  if (v_ref is not distinct from 'exercise') <> (p_exercise_id is not null)
     or (v_ref is distinct from 'exercise' and (p_device_id is not null or p_reps is not null))
     or (v_ref is not distinct from 'habit') <> (p_habit_id is not null)
     or (v_ref is not distinct from 'measurement') <> (p_measurement_kind is not null) then
    raise exception 'reference_does_not_fit_metric' using errcode = '22023';
  end if;
  if v_ref = 'exercise' then
    select e.measure into v_measure from public.exercises e where e.id = p_exercise_id;
    if v_measure is null then
      raise exception 'exercise_not_found' using errcode = '22023';
    end if;
    if (v_measure = 'weight_reps') <> (p_reps is not null) then
      raise exception 'reps_only_for_weight_exercises' using errcode = '22023';
    end if;
    if p_device_id is not null and not exists (select 1 from public.devices d where d.id = p_device_id) then
      raise exception 'device_not_found' using errcode = '22023';
    end if;
  end if;
  if v_ref = 'habit'
     and not exists (select 1 from public.habits h where h.id = p_habit_id and h.user_id = v_user) then
    raise exception 'habit_not_found' using errcode = '42501';
  end if;
  if v_ref = 'measurement'
     and not exists (select 1 from public.body_measurement_kinds k where k.key = p_measurement_kind) then
    raise exception 'unknown_measurement_kind' using errcode = '22023';
  end if;
  if p_id is not null and exists (select 1 from public.goals g where g.id = p_id) then
    raise exception 'goal_id_taken' using errcode = '23505';
  end if;

  insert into public.goals (id, user_id, metric, exercise_id, device_id, habit_id,
                            measurement_kind, reps, starts_on, ends_on, start_value, visibility)
  values (coalesce(p_id, gen_random_uuid()), v_user, p_metric, p_exercise_id, p_device_id,
          p_habit_id, p_measurement_kind, p_reps, p_starts_on, p_ends_on, p_start_value,
          coalesce(p_visibility, 'private'))
  returning id into v_id;
  insert into public.goal_versions (goal_id, valid_from, min_value, target_value)
  values (v_id, p_starts_on, p_min_value, p_target_value);
  return v_id;
end;
$$;

-- Changes a goal. Period, start value and visibility are changed as they are (they describe
-- the goal); minimum and target get a new version from p_valid_from on (default: today; not
-- before the start), so the days and weeks before keep the old rule. A version that ends up
-- equal to the one before it is removed (undo by saving the old values again leaves no
-- trace).
create function public.update_goal(
  p_goal_id uuid,
  p_starts_on date,
  p_ends_on date,
  p_start_value numeric,
  p_min_value numeric,
  p_target_value numeric,
  p_visibility text,
  p_valid_from date default current_date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.goals;
  v_from date;
  v_prev public.goal_versions;
begin
  if not private.can_edit_goal(p_goal_id) then
    raise exception 'goal_not_found' using errcode = '42501';
  end if;
  select * into g from public.goals x where x.id = p_goal_id;
  if p_starts_on is null or p_ends_on is null or p_ends_on <= p_starts_on then
    raise exception 'invalid_period' using errcode = '22023';
  end if;
  perform private.check_goal_values(g.metric, p_start_value, p_min_value, p_target_value);

  update public.goals
     set starts_on = p_starts_on, ends_on = p_ends_on, start_value = p_start_value,
         visibility = coalesce(p_visibility, g.visibility)
   where id = p_goal_id;

  v_from := greatest(coalesce(p_valid_from, current_date), p_starts_on);
  -- The first version starts with the goal.
  if not exists (select 1 from public.goal_versions v
                  where v.goal_id = p_goal_id and v.valid_from < v_from) then
    v_from := (select min(v.valid_from) from public.goal_versions v where v.goal_id = p_goal_id);
  end if;
  insert into public.goal_versions (goal_id, valid_from, min_value, target_value)
  values (p_goal_id, v_from, p_min_value, p_target_value)
  on conflict (goal_id, valid_from) do update
    set min_value = excluded.min_value, target_value = excluded.target_value;

  select * into v_prev from public.goal_versions v
   where v.goal_id = p_goal_id and v.valid_from < v_from
   order by v.valid_from desc limit 1;
  if found and v_prev.min_value is not distinct from p_min_value
     and v_prev.target_value = p_target_value then
    delete from public.goal_versions v where v.goal_id = p_goal_id and v.valid_from = v_from;
  end if;
end;
$$;

-- Archive (gone from the list, kept; others no longer see it) or bring back.
create function public.archive_goal(p_goal_id uuid, p_archive boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_edit_goal(p_goal_id) then
    raise exception 'goal_not_found' using errcode = '42501';
  end if;
  update public.goals set archived_at = case when p_archive then now() end
   where id = p_goal_id;
end;
$$;

revoke all on function private.can_edit_goal(uuid) from public, anon, authenticated;
revoke all on function private.can_view_goal(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function private.goal_values_hidden(uuid, text) from public, anon, authenticated;
revoke all on function private.goal_version_at(uuid, date) from public, anon, authenticated;
revoke all on function private.goal_unit(text, uuid, text) from public, anon, authenticated;
revoke all on function private.training_weeks(uuid, date, date, text) from public, anon, authenticated;
revoke all on function private.goal_training_weeks(public.goals, date, text) from public, anon, authenticated;
revoke all on function private.goal_habit_quota(uuid, uuid, date, date, date, text) from public, anon, authenticated;
revoke all on function private.goal_exercise_days(uuid, uuid, uuid, integer, date, date, text) from public, anon, authenticated;
revoke all on function private.goal_figures(public.goals, date, text) from public, anon, authenticated;
revoke all on function private.check_goal_values(text, numeric, numeric, numeric) from public, anon, authenticated;
revoke all on function public.goal_progress(uuid, date, text, boolean, uuid) from public, anon;
revoke all on function public.goal_history(uuid, date, text) from public, anon;
revoke all on function public.goal_start_suggestion(text, date, text, uuid, uuid, uuid, text, integer) from public, anon;
revoke all on function public.goal_reference_options(text) from public, anon;
revoke all on function public.create_goal(uuid, text, date, date, numeric, numeric, numeric, text, uuid, uuid, uuid, text, integer) from public, anon;
revoke all on function public.update_goal(uuid, date, date, numeric, numeric, numeric, text, date) from public, anon;
revoke all on function public.archive_goal(uuid, boolean) from public, anon;
grant execute on function public.goal_progress(uuid, date, text, boolean, uuid) to authenticated;
grant execute on function public.goal_history(uuid, date, text) to authenticated;
grant execute on function public.goal_start_suggestion(text, date, text, uuid, uuid, uuid, text, integer) to authenticated;
grant execute on function public.goal_reference_options(text) to authenticated;
grant execute on function public.create_goal(uuid, text, date, date, numeric, numeric, numeric, text, uuid, uuid, uuid, text, integer) to authenticated;
grant execute on function public.update_goal(uuid, date, date, numeric, numeric, numeric, text, date) to authenticated;
grant execute on function public.archive_goal(uuid, boolean) to authenticated;
