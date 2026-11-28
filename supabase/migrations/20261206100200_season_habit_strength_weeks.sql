-- Baustein 8c-3 (seasons, social): two more lines of the season in the group comparison.
-- Separate functions next to season_progress_weeks, so the Übersicht and its function stay
-- exactly as they are (different grids, too: calendar weeks for habits, the season's week
-- ends for strength).
--
--   season_habit_weeks:    per participant and calendar week the quota of their season
--                          habits (Vergleich → Habits, period "Saison")
--   season_strength_weeks: per participant with a strength goal (exercise best) and point
--                          of the season's weeks the mean increase since the start
--                          (Vergleich → Kraft)
--
-- Access: members of the season's group (and the super admin), as the other season read
-- functions. Only percentages leave: no habit names, no values, no kg, no exercises. The
-- personal migrations stay untouched: this layer reads them.

-- Per participant and calendar week (week_start: its Monday) from the participant's start
-- up to today (at most the season's end): the quota of all their season habits – private
-- ones too, since only the quota leaves – scored by private.habit_week_quota (as the
-- habit statistics; season_overview's habit quota counts the same days and weeks). A week
-- in which nothing counted has no row; counted: the habits that counted in it.
create function public.season_habit_weeks(
  p_season_id uuid,
  p_today date default current_date,
  p_time_zone text default 'Europe/Berlin'
)
returns table (
  user_id uuid,
  week_start date,
  quota_pct numeric,
  counted integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with s as (
    select x.* from public.seasons x
     where x.id = p_season_id
       and (private.is_group_member(x.group_id) or private.is_super_admin())
  ),
  m as (
    select pm.user_id, pm.starts_on, least(p_today, s.ends_on) as to_d, pm.added_at,
           array(select sh.habit_id from public.season_habits sh
                  where sh.season_id = pm.season_id and sh.user_id = pm.user_id) as habit_ids
      from public.season_members pm
      join s on s.id = pm.season_id
  )
  select m.user_id, q.week_start, q.quota_pct, q.counted
    from m
   cross join lateral private.habit_week_quota(
     m.user_id, m.habit_ids, m.starts_on, m.to_d, p_today, p_time_zone) q
   where cardinality(m.habit_ids) > 0
   order by m.added_at, m.user_id, q.week_start;
$$;

-- Per participant with at least one (not archived) season goal of metric exercise_best and
-- per point of the season's weeks (the same points as season_progress_weeks: the
-- participant's start, every season week's last day after it and before today, and today –
-- at most the season's end): the mean over those goals of the increase since the start,
-- (current − start) / start × 100, current as goal_figures reports it on that day (the best
-- set since the goal's start, converted to the goal's reps); a goal without a set yet (or
-- without a start value) counts as 0 %. May be below 0.
create function public.season_strength_weeks(
  p_season_id uuid,
  p_today date default current_date,
  p_time_zone text default 'Europe/Berlin'
)
returns table (
  user_id uuid,
  on_date date,
  strength_pct numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with s as (
    select x.* from public.seasons x
     where x.id = p_season_id
       and (private.is_group_member(x.group_id) or private.is_super_admin())
  ),
  last_day as (
    select least(p_today, s.ends_on) as d from s
  ),
  points as (
    select m.user_id, p.on_date
      from s
      join public.season_members m on m.season_id = s.id
      cross join last_day l
      cross join lateral (
        select m.starts_on as on_date
        union
        select (s.starts_on + 6 + 7 * k) from generate_series(0, (s.ends_on - s.starts_on) / 7) k
        union
        select l.d
      ) p
     where p.on_date between m.starts_on and l.d
  ),
  season_goal_ids as (
    select sg.goal_id from public.season_goals sg
      join s on s.id = sg.season_id
  )
  select p.user_id, p.on_date,
         round(avg(coalesce(
           (f.current_value - g.start_value) / nullif(g.start_value, 0) * 100, 0)), 1)
    from points p
    join public.goals g on g.user_id = p.user_id and g.archived_at is null
                       and g.metric = 'exercise_best'
                       and g.id in (select x.goal_id from season_goal_ids x)
   cross join lateral private.goal_figures(g, p.on_date, p_time_zone) f
   group by p.user_id, p.on_date
   order by p.user_id, p.on_date;
$$;

revoke all on function public.season_habit_weeks(uuid, date, text) from public, anon;
revoke all on function public.season_strength_weeks(uuid, date, text) from public, anon;
grant execute on function public.season_habit_weeks(uuid, date, text) to authenticated;
grant execute on function public.season_strength_weeks(uuid, date, text) to authenticated;
