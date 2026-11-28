-- Baustein 8c-2 (seasons, social): the "Übersicht" of a season in the group comparison –
-- how every participant is doing, at a glance. Computed, nothing stored; the figures come
-- from the goals and habits cores (private.goal_figures, private.goal_habit_quota), the
-- rules are counted from the body tables (done / not done only, never values).
--
--   season_overview:       one row per participant – the trainings goal's weeks ("in x of
--                          y weeks"), status and on-track of every season goal, the mean
--                          quota of the season habits, the season rules counted.
--   season_progress_weeks: per participant and week end the mean progress (0–100 %) of the
--                          season goals with a start and a target (level goals). A row
--                          shape that later stages extend by further columns.
--
-- Access: members of the season's group (and the super admin, as season_habits_overview).
-- Progress in % and status are the group's to see by the concept; kg / cm never leave
-- through these functions. The personal migrations stay untouched: this layer reads them.

-- ---------------------------------------------------------------------------
-- Reading
-- ---------------------------------------------------------------------------

-- Whether a span of days has at least one day that is not paused (habit pauses, which also
-- pause the trainings goal and the season rules).
create function private.season_span_free(p_user_id uuid, p_from date, p_to date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from generate_series(p_from, p_to, interval '1 day') d
     where not exists (select 1 from public.habit_pauses p
                        where p.user_id = p_user_id
                          and d::date between p.from_date and p.to_date));
$$;

-- Per participant of a season (in the order they were added), as of p_today (at most the
-- season's end):
--   training_weeks / training_weeks_met: of the first (not archived) trainings-per-week
--     season goal – the finished weeks that count (fully paused weeks drop out) and those
--     in which the weekly target was reached (goal_figures: counted / target_met); null
--     without such a goal.
--   goals: every (not archived) season goal in the metrics' order, as
--     [{goal_id, metric, status, on_track}] (status / on_track from goal_figures; null
--     while nothing was measured); [] without goals.
--   habit_count / habit_quota_pct: the season habits and the mean of their quotas since
--     the participant's start (as season_habits_overview counts them); the quota null
--     while none has counted anything.
--   weigh_weeks_done / weigh_weeks_due (rule "weigh weekly", else null): calendar weeks
--     since the participant's start (cut at the season's end) with at least one weigh-in /
--     that count – a week counts once it is over or once it is done; a week fully paused
--     does not count.
--   checkins_done / checkins_due (rule "Zwischenstand every x weeks", else null): sections
--     of x weeks from the participant's start (cut at the season's end) with a check-in
--     that was not skipped / that count – a section counts once it is over or once it is
--     done; a section fully paused does not count.
create function public.season_overview(
  p_season_id uuid,
  p_today date default current_date,
  p_time_zone text default 'Europe/Berlin'
)
returns table (
  user_id uuid,
  starts_on date,
  training_weeks integer,
  training_weeks_met integer,
  goals jsonb,
  habit_count integer,
  habit_quota_pct numeric,
  weigh_weeks_done integer,
  weigh_weeks_due integer,
  checkins_done integer,
  checkins_due integer
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
    select pm.*, s.ends_on as season_ends_on, s.weigh_weekly, s.checkin_every_weeks
      from public.season_members pm
      join s on s.id = pm.season_id
  ),
  figures as (
    select g.user_id, g.id, g.metric, gm.sort, g.created_at, f.status, f.on_track, f.counted,
           f.target_met
      from public.season_goals sg
      join s on s.id = sg.season_id
      join public.goals g on g.id = sg.goal_id and g.archived_at is null
      join public.goal_metrics gm on gm.key = g.metric
     cross join lateral private.goal_figures(g, p_today, p_time_zone) f
  ),
  habits as (
    select sh.user_id, count(*)::integer as habit_count, round(avg(q.quota_pct), 1) as quota
      from public.season_habits sh
      join m on m.season_id = sh.season_id and m.user_id = sh.user_id
      left join lateral private.goal_habit_quota(
        sh.user_id, sh.habit_id, m.starts_on, least(p_today, m.season_ends_on), p_today,
        p_time_zone) q on true
     group by sh.user_id
  ),
  -- Calendar weeks of a participant inside the season, from their start up to today.
  weeks as (
    select m.user_id, min(d.on_date) as from_d, max(d.on_date) as to_d
      from m
     cross join lateral (
       select x::date as on_date
         from generate_series(m.starts_on, m.season_ends_on, interval '1 day') x
     ) d
     where m.weigh_weekly
     group by m.user_id, date_trunc('week', d.on_date::timestamp)
    having min(d.on_date) <= p_today
  ),
  -- Sections of checkin_every_weeks weeks from a participant's start, up to today.
  sections as (
    select m.user_id, m.starts_on + 7 * m.checkin_every_weeks * k as from_d,
           least(m.starts_on + 7 * m.checkin_every_weeks * (k + 1) - 1, m.season_ends_on) as to_d
      from m
     cross join lateral generate_series(
       0, (m.season_ends_on - m.starts_on) / (7 * m.checkin_every_weeks)) k
     where m.checkin_every_weeks is not null
       and m.starts_on + 7 * m.checkin_every_weeks * k <= p_today
  ),
  weigh as (
    select w.user_id,
           count(*) filter (where w.done)::integer as done,
           count(*) filter (where w.to_d < p_today or w.done)::integer as due
      from (
        select w.user_id, w.to_d,
               exists (select 1 from public.weigh_ins x
                        where x.user_id = w.user_id
                          and x.measured_on between w.from_d and least(w.to_d, p_today)) as done
          from weeks w
         where private.season_span_free(w.user_id, w.from_d, w.to_d)
      ) w
     group by w.user_id
  ),
  checkins as (
    select c.user_id,
           count(*) filter (where c.done)::integer as done,
           count(*) filter (where c.to_d < p_today or c.done)::integer as due
      from (
        select x.user_id, x.to_d,
               exists (select 1 from public.body_checkins b
                        where b.user_id = x.user_id and not b.skipped
                          and b.on_date between x.from_d and least(x.to_d, p_today)) as done
          from sections x
         where private.season_span_free(x.user_id, x.from_d, x.to_d)
      ) c
     group by c.user_id
  )
  select m.user_id, m.starts_on,
         t.counted, t.target_met,
         coalesce((select jsonb_agg(jsonb_build_object(
                             'goal_id', f.id, 'metric', f.metric, 'status', f.status,
                             'on_track', f.on_track)
                           order by f.sort, f.created_at, f.id)
                     from figures f where f.user_id = m.user_id), '[]'::jsonb),
         coalesce(h.habit_count, 0), h.quota,
         case when m.weigh_weekly then coalesce(w.done, 0) end,
         case when m.weigh_weekly then coalesce(w.due, 0) end,
         case when m.checkin_every_weeks is not null then coalesce(c.done, 0) end,
         case when m.checkin_every_weeks is not null then coalesce(c.due, 0) end
    from m
    left join lateral (
      select f.counted, f.target_met from figures f
       where f.user_id = m.user_id and f.metric = 'trainings_per_week'
       order by f.created_at, f.id limit 1
    ) t on true
    left join habits h on h.user_id = m.user_id
    left join weigh w on w.user_id = m.user_id
    left join checkins c on c.user_id = m.user_id
   order by m.added_at, m.user_id;
$$;

-- Per participant with at least one (not archived) season goal of kind "level" (body
-- weight, exercise best, body measurement) and per point of the season's weeks: the mean
-- progress of those goals, each the share of the way from start to target clamped to
-- 0 … 100 % (goal_figures as of that day; a goal without a value yet counts as 0 %).
-- Points: the participant's start, every season week's last day (the season's start + 6,
-- + 13, …) after it and before today, and today (at most the season's end).
-- One row per participant and day; later stages add columns (e.g. strength, habit quota
-- per week) by replacing this function.
create function public.season_progress_weeks(
  p_season_id uuid,
  p_today date default current_date,
  p_time_zone text default 'Europe/Berlin'
)
returns table (
  user_id uuid,
  on_date date,
  goal_progress_pct numeric
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
  levels as (
    select sg.goal_id from public.season_goals sg
      join s on s.id = sg.season_id
  )
  select p.user_id, p.on_date,
         round(avg(greatest(0, least(100, coalesce(f.progress_pct, 0)))), 1)
    from points p
    join public.goals g on g.user_id = p.user_id and g.archived_at is null
                       and g.id in (select l.goal_id from levels l)
    join public.goal_metrics gm on gm.key = g.metric and gm.kind = 'level'
   cross join lateral private.goal_figures(g, p.on_date, p_time_zone) f
   group by p.user_id, p.on_date
   order by p.user_id, p.on_date;
$$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
revoke all on function private.season_span_free(uuid, date, date) from public, anon, authenticated;
revoke all on function public.season_overview(uuid, date, text) from public, anon;
revoke all on function public.season_progress_weeks(uuid, date, text) from public, anon;
grant execute on function public.season_overview(uuid, date, text) to authenticated;
grant execute on function public.season_progress_weeks(uuid, date, text) to authenticated;
