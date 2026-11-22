-- Baustein 6d-1 (habits, personal): sharing per habit with the people one shares a group
-- with (asked through private.can_view_user_data, never groups directly – rule 13).
--   private (default) · done: whether it was met (and the share), no values · values: also
--   the values (minutes, steps, times).
-- The habit's days, weeks, figures can now be read for others' shared habits; values are
-- left out unless shared "mit Werten" (so averages and charts of values stay empty).

alter table public.habits
  add column share_level text not null default 'private'
    check (share_level in ('private', 'done', 'values'));
grant update (share_level) on public.habits to authenticated;

drop policy "habits: own" on public.habits;
create policy "habits: own or shared" on public.habits
  for select to authenticated
  using (user_id = (select auth.uid())
         or (share_level <> 'private' and private.can_view_user_data(user_id, 'habits')));

drop policy "habit_versions: own" on public.habit_versions;
create policy "habit_versions: own or shared" on public.habit_versions
  for select to authenticated
  using (exists (select 1 from public.habits h
                  where h.id = habit_id
                    and (h.user_id = (select auth.uid())
                         or (h.share_level <> 'private'
                             and private.can_view_user_data(h.user_id, 'habits')))));

drop policy "habit_entries: own" on public.habit_entries;
create policy "habit_entries: own or shared with values" on public.habit_entries
  for select to authenticated
  using (exists (select 1 from public.habits h
                  where h.id = habit_id
                    and (h.user_id = (select auth.uid())
                         or (h.share_level = 'values'
                             and private.can_view_user_data(h.user_id, 'habits')))));

create or replace function public.habit_days(
  p_user_id uuid,
  p_from date,
  p_to date,
  p_today date default current_date,
  -- The phone's time zone: which day a training counts for.
  p_time_zone text default 'Europe/Berlin'
)
returns table (
  habit_id uuid,
  on_date date,
  version_id uuid,
  name text,
  input_type text,
  frequency text,
  source text,
  time_of_day text,
  due boolean,
  paused boolean,
  value jsonb,
  score numeric,
  state text
)
language sql
stable
security definer
set search_path = ''
as $$
  with days as (
    select d::date as on_date from generate_series(p_from, p_to, interval '1 day') d
  ),
  hv as (
    select d.on_date, v.*, h.share_level as share
      from public.habits h
      cross join days d
      cross join lateral (
        select * from public.habit_versions v
         where v.habit_id = h.id and v.valid_from <= d.on_date
         order by v.valid_from desc limit 1
      ) v
     where h.user_id = p_user_id
       and (p_user_id = (select auth.uid()) or (h.share_level <> 'private' and private.can_view_user_data(p_user_id, 'habits')))
       and (h.archived_at is null or d.on_date < (h.archived_at at time zone 'UTC')::date)
  ),
  judged as (
    select hv.habit_id, hv.on_date, hv.id as version_id, hv.name, hv.input_type, hv.frequency,
           hv.source, hv.time_of_day,
           case hv.frequency
             when 'daily' then true
             when 'weekdays' then extract(isodow from hv.on_date)::smallint = any (hv.weekdays)
             else false
           end as due,
           exists (select 1 from public.habit_pauses p
                    where p.user_id = p_user_id and hv.on_date between p.from_date and p.to_date) as paused,
           case when hv.source = 'training' then
             case when exists (
               select 1 from public.workouts w
                where w.user_id = p_user_id and w.status = 'finished'
                  and (w.started_at at time zone p_time_zone)::date = hv.on_date)
             then '{"done":true}'::jsonb end
           else e.value end as value,
           hv.share
      from hv
      left join public.habit_entries e on e.habit_id = hv.habit_id and e.on_date = hv.on_date
  )
  select j.habit_id, j.on_date, j.version_id, j.name, j.input_type, j.frequency, j.source,
         j.time_of_day, j.due, j.paused,
         -- values only for me, or when shared "mit Werten"
         case when p_user_id = (select auth.uid()) or j.share = 'values' then j.value end,
         case when j.value is not null then
           private.habit_score(
             (select v from public.habit_versions v where v.id = j.version_id), j.value)
         end as score,
         case
           when j.paused then 'paused'
           when j.frequency = 'weekly' then
             case when j.value is not null and private.habit_score(
               (select v from public.habit_versions v where v.id = j.version_id), j.value) >= 1
             then 'done' end
           when not j.due then null
           when j.value is null then case when j.on_date >= p_today then 'open' else 'missed' end
           else case
             when private.habit_score((select v from public.habit_versions v where v.id = j.version_id), j.value) >= 1 then 'done'
             when private.habit_score((select v from public.habit_versions v where v.id = j.version_id), j.value) > 0 then 'partial'
             else 'missed'
           end
         end as state
    from judged j
   order by j.on_date, j.habit_id;
$$;

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
     where h.user_id = p_user_id
       and (p_user_id = (select auth.uid()) or (h.share_level <> 'private' and private.can_view_user_data(p_user_id, 'habits')))
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
