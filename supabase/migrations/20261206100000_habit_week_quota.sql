-- Habits (personal): a person's habit quota per calendar week over a set of their habits,
-- for the weekly quota lines of the group comparison (8c-3). Built on the judging cores,
-- so a week is scored exactly as the habit statistics score it:
--   daily / weekday habits: the mean score of the days answered or missed in that week
--     (partly met counts partly; pauses, days not due and open days do not count)
--   weekly habits: 100 % for a week done, 0 % for one missed (an open week – the running
--     one until it is done – and a paused one do not count)
-- and the person's quota of a week is the mean over the habits that counted something in
-- it. No access check: callers decide whose habits they pass (internal, not callable by
-- clients). Computed, nothing stored; references no social table.

create function private.habit_week_quota(
  p_user_id uuid,
  p_habit_ids uuid[],
  p_from date,
  p_to date,
  p_today date,
  p_time_zone text
)
returns table (
  week_start date,
  quota_pct numeric,
  counted integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with days as (
    select d.habit_id, date_trunc('week', d.on_date::timestamp)::date as week_start,
           least(coalesce(d.score, 0), 1) as score
      from private.habit_days_judged(p_user_id, p_from, p_to, p_today, p_time_zone) d
     where p_from <= p_to
       and d.habit_id = any (p_habit_ids)
       and d.frequency <> 'weekly'
       and d.state in ('done', 'partial', 'missed')
  ),
  weeks as (
    select w.habit_id, w.week_start, case when w.state = 'done' then 1 else 0 end::numeric as score
      from private.habit_weeks_judged(p_user_id, p_from, p_to, p_today, p_time_zone) w
     where p_from <= p_to
       and w.habit_id = any (p_habit_ids)
       and w.state in ('done', 'missed')
       and w.week_start between date_trunc('week', p_from::timestamp)::date and p_to
  ),
  per_habit as (
    select d.habit_id, d.week_start, avg(d.score) as quota from days d group by 1, 2
    union all
    select w.habit_id, w.week_start, w.score from weeks w
  )
  select h.week_start, round(avg(h.quota) * 100, 1), count(*)::integer
    from per_habit h
   group by h.week_start
   order by h.week_start;
$$;

revoke all on function private.habit_week_quota(uuid, uuid[], date, date, date, text)
  from public, anon, authenticated;
