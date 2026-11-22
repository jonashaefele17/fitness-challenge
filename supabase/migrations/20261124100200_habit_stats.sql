-- Baustein 6b: habit figures, computed (never stored).
--   quota: how far the habit was met in the range – daily habits: the mean score of the
--          answered or missed days (partly met counts partly); weekly habits: weeks met
--          out of the weeks that ended (pauses and the running week do not count)
--   current_streak / best_streak: days (daily) or weeks (weekly) met in a row, over the
--          habit's whole life; pauses and days not due do not break a streak, and today
--          (or this week) only adds once it is met.

create function public.habit_stats(
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
  day_runs as (
    select habit_id, state,
           sum(case when state = 'done' then 0 else 1 end)
             over (partition by habit_id order by on_date) as run
      from days
  ),
  week_runs as (
    select habit_id, state,
           sum(case when state = 'done' then 0 else 1 end)
             over (partition by habit_id order by week_start) as run
      from weeks
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

revoke all on function public.habit_stats(uuid, date, date, date, text) from public, anon;
grant execute on function public.habit_stats(uuid, date, date, date, text) to authenticated;
