-- Habits, after the first look at the evaluation (Jonas, 23.11.2026):
-- - Streaks forgive: one missed day (or week) does not end a run, two in a row do. The
--   missed day itself does not count.
-- - habit_summary: the figures in plain words per habit and range – how often met, the
--   share, the share of the range before (trend), averages and best value of numbers and
--   durations, average bed and wake-up time, how often each choice or item.

create or replace function public.habit_stats(
  p_user_id uuid,
  p_from date,
  p_to date,
  p_today date default current_date,
  p_time_zone text default 'Europe/Berlin'
)
returns table (
  habit_id uuid,
  unit text,
  counted integer,
  met integer,
  quota numeric,
  current_streak integer,
  best_streak integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with since as (
    select coalesce(min(v.valid_from), p_today) as first_day
      from public.habit_versions v
      join public.habits h on h.id = v.habit_id
     where h.user_id = p_user_id
  ),
  days as (
    select d.habit_id, d.on_date, d.state, least(coalesce(d.score, 0), 1) as score
      from since, public.habit_days(p_user_id, since.first_day, p_today, p_today, p_time_zone) d
     where d.frequency <> 'weekly' and d.state in ('done', 'partial', 'missed')
  ),
  weeks as (
    select w.habit_id, w.week_start, w.state
      from since, public.habit_weeks(p_user_id, since.first_day, p_today, p_today, p_time_zone) w
     where w.state in ('done', 'missed')
  ),
  -- A run of met days/weeks ends at each one not met: number the runs.
  -- Forgiving: one miss does not end a run, two in a row do ("nie zweimal verpassen").
  day_marks as (
    select habit_id, state, on_date,
           case when state <> 'done'
                 and lag(state) over (partition by habit_id order by on_date) is distinct from 'done'
                 and lag(state) over (partition by habit_id order by on_date) is not null
                then 1 else 0 end as breaks
      from days
  ),
  day_runs as (
    select habit_id, state,
           sum(breaks) over (partition by habit_id order by on_date) as run
      from day_marks
  ),
  week_marks as (
    select habit_id, state, week_start,
           case when state <> 'done'
                 and lag(state) over (partition by habit_id order by week_start) is distinct from 'done'
                 and lag(state) over (partition by habit_id order by week_start) is not null
                then 1 else 0 end as breaks
      from weeks
  ),
  week_runs as (
    select habit_id, state,
           sum(breaks) over (partition by habit_id order by week_start) as run
      from week_marks
  ),
  day_streaks as (
    select habit_id,
           max(len) as best,
           (array_agg(len order by run desc))[1] as current
      from (select habit_id, run, count(*) filter (where state = 'done')::integer as len
              from day_runs group by habit_id, run) r
     group by habit_id
  ),
  week_streaks as (
    select habit_id,
           max(len) as best,
           (array_agg(len order by run desc))[1] as current
      from (select habit_id, run, count(*) filter (where state = 'done')::integer as len
              from week_runs group by habit_id, run) r
     group by habit_id
  ),
  day_quota as (
    select habit_id, count(*)::integer as counted,
           count(*) filter (where state = 'done')::integer as met,
           round(avg(score), 3) as quota
      from days where on_date between p_from and p_to
     group by habit_id
  ),
  week_quota as (
    select habit_id, count(*)::integer as counted,
           count(*) filter (where state = 'done')::integer as met,
           round(avg(case when state = 'done' then 1 else 0 end), 3) as quota
      from weeks where week_start between date_trunc('week', p_from::timestamp)::date and p_to
     group by habit_id
  ),
  mine as (
    select h.id,
           (select v.frequency from public.habit_versions v
             where v.habit_id = h.id and v.valid_from <= p_today
             order by v.valid_from desc limit 1) as frequency
      from public.habits h
     where h.user_id = p_user_id and p_user_id = (select auth.uid())
  )
  select m.id,
         case when m.frequency = 'weekly' then 'weeks' else 'days' end,
         coalesce(case when m.frequency = 'weekly' then wq.counted else dq.counted end, 0),
         coalesce(case when m.frequency = 'weekly' then wq.met else dq.met end, 0),
         case when m.frequency = 'weekly' then wq.quota else dq.quota end,
         coalesce(case when m.frequency = 'weekly' then ws.current else ds.current end, 0),
         coalesce(case when m.frequency = 'weekly' then ws.best else ds.best end, 0)
    from mine m
    left join day_quota dq on dq.habit_id = m.id
    left join week_quota wq on wq.habit_id = m.id
    left join day_streaks ds on ds.habit_id = m.id
    left join week_streaks ws on ws.habit_id = m.id;
$$;

create function public.habit_summary(
  p_user_id uuid,
  p_from date,
  p_to date,
  p_today date default current_date,
  p_time_zone text default 'Europe/Berlin'
)
returns table (
  habit_id uuid,
  counted integer,
  met integer,
  quota numeric,
  previous_quota numeric,
  avg_value numeric,
  best_value numeric,
  avg_start integer,
  avg_end integer,
  avg_duration integer,
  choice_counts jsonb,
  item_counts jsonb,
  complete_days integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with now_stats as (
    select * from public.habit_stats(p_user_id, p_from, p_to, p_today, p_time_zone)
  ),
  before_stats as (
    select * from public.habit_stats(
      p_user_id, p_from - (p_to - p_from + 1), p_from - 1, p_today, p_time_zone)
  ),
  days as (
    select d.*
      from public.habit_days(p_user_id, p_from, p_to, p_today, p_time_zone) d
     where d.value is not null and not d.paused
  ),
  versions as (
    -- the rule valid at the end of the range (best value: highest for "at least", lowest
    -- for "at most")
    select distinct on (v.habit_id) v.habit_id, v.rule
      from public.habit_versions v
     where v.valid_from <= p_to
     order by v.habit_id, v.valid_from desc
  ),
  -- minutes after 18:00, so nights average without wrapping at midnight
  nights as (
    select habit_id,
           ((split_part(value ->> 'start', ':', 1)::int * 60 + split_part(value ->> 'start', ':', 2)::int) - 1080 + 1440) % 1440 as s,
           ((split_part(value ->> 'end', ':', 1)::int * 60 + split_part(value ->> 'end', ':', 2)::int) - 1080 + 1440) % 1440 as e
      from days where input_type = 'time_pair'
  ),
  figures as (
    select d.habit_id,
           round(avg(coalesce((d.value ->> 'value')::numeric, (d.value ->> 'minutes')::numeric)), 1) as avg_value,
           case when (select v.rule -> 0 ->> 'op' from versions v where v.habit_id = d.habit_id) = 'max'
                then min(coalesce((d.value ->> 'value')::numeric, (d.value ->> 'minutes')::numeric))
                else max(coalesce((d.value ->> 'value')::numeric, (d.value ->> 'minutes')::numeric)) end as best_value,
           count(*) filter (where d.input_type = 'checklist' and d.state = 'done')::integer as complete_days
      from days d
     group by d.habit_id
  ),
  night_figures as (
    select habit_id, round(avg(s))::integer as s, round(avg(e))::integer as e,
           round(avg((e - s + 1440) % 1440))::integer as dur
      from nights group by habit_id
  ),
  choices as (
    select habit_id, jsonb_object_agg(choice, n) as counts
      from (select habit_id, value ->> 'choice' as choice, count(*) as n
              from days where input_type = 'choice' group by 1, 2) c
     group by habit_id
  ),
  items as (
    select habit_id, jsonb_object_agg(item, n) as counts
      from (select d.habit_id, i as item, count(*) as n
              from days d cross join lateral jsonb_array_elements_text(d.value -> 'checked') i
             where d.input_type = 'checklist' group by 1, 2) c
     group by habit_id
  )
  select s.habit_id, s.counted, s.met, s.quota, b.quota,
         f.avg_value, f.best_value,
         (nf.s + 1080) % 1440, (nf.e + 1080) % 1440, nf.dur,
         c.counts, i.counts, coalesce(f.complete_days, 0)
    from now_stats s
    left join before_stats b on b.habit_id = s.habit_id
    left join figures f on f.habit_id = s.habit_id
    left join night_figures nf on nf.habit_id = s.habit_id
    left join choices c on c.habit_id = s.habit_id
    left join items i on i.habit_id = s.habit_id;
$$;

revoke all on function public.habit_summary(uuid, date, date, date, text) from public, anon;
grant execute on function public.habit_summary(uuid, date, date, date, text) to authenticated;
