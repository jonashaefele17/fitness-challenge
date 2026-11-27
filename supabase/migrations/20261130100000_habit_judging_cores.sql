-- Habits (personal): the judging split from the access check, so other personal modules can
-- build on it in SQL (rule 14) – goals (8a) judge a habit goal and the trainings-per-week goal
-- with exactly the habits' rules, also when someone else looks at a shared goal.
--   private.habit_week_target:  the weekly target shrunk by free days (the one rounding rule)
--   private.habit_days_judged:  habit_days without access check, values unmasked
--   private.habit_weeks_judged: habit_weeks without access check
-- public.habit_days / habit_weeks keep their behaviour: they read the cores and apply the
-- access check and the value masking as before. Internal functions are not callable by
-- clients.

-- A weekly target for a week with only some free days (the rest paused, or outside the
-- range that counts): target × free days / 7, rounded up. 0 free days: 0.
create function private.habit_week_target(p_target numeric, p_free_days integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select ceil(p_target * p_free_days / 7.0)::integer;
$$;

create function private.habit_days_judged(
  p_user_id uuid,
  p_from date,
  p_to date,
  p_today date,
  p_time_zone text
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
    select d.on_date, v.*
      from public.habits h
      cross join days d
      cross join lateral (
        select * from public.habit_versions v
         where v.habit_id = h.id and v.valid_from <= d.on_date
         order by v.valid_from desc limit 1
      ) v
     where h.user_id = p_user_id
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
           else e.value end as value
      from hv
      left join public.habit_entries e on e.habit_id = hv.habit_id and e.on_date = hv.on_date
  )
  select j.habit_id, j.on_date, j.version_id, j.name, j.input_type, j.frequency, j.source,
         j.time_of_day, j.due, j.paused, j.value,
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

create function private.habit_weeks_judged(
  p_user_id uuid,
  p_from date,
  p_to date,
  p_today date,
  p_time_zone text
)
returns table (
  habit_id uuid,
  week_start date,
  done_days integer,
  target integer,
  state text
)
language sql
stable
security definer
set search_path = ''
as $$
  with days as (
    select * from private.habit_days_judged(
      p_user_id,
      date_trunc('week', p_from::timestamp)::date,
      (date_trunc('week', p_to::timestamp) + interval '6 days')::date,
      p_today, p_time_zone)
     where frequency = 'weekly'
  ),
  weeks as (
    select d.habit_id, date_trunc('week', d.on_date::timestamp)::date as week_start,
           count(*) filter (where d.state = 'done')::integer as done_days,
           count(*) filter (where not d.paused)::integer as free_days,
           max(v.times_per_week) filter (where d.on_date = (select max(x.on_date) from days x
                                                              where x.habit_id = d.habit_id
                                                                and date_trunc('week', x.on_date::timestamp) = date_trunc('week', d.on_date::timestamp)))
             as times_per_week
      from days d
      join public.habit_versions v on v.id = d.version_id
     group by d.habit_id, date_trunc('week', d.on_date::timestamp)
  )
  select w.habit_id, w.week_start, w.done_days,
         private.habit_week_target(w.times_per_week, w.free_days) as target,
         case
           when w.free_days = 0 then 'paused'
           when w.done_days >= private.habit_week_target(w.times_per_week, w.free_days) then 'done'
           when w.week_start + 6 >= p_today then 'open'
           else 'missed'
         end
    from weeks w
   order by w.week_start, w.habit_id;
$$;

-- The public functions: same results as before, now on top of the cores.
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
  select d.habit_id, d.on_date, d.version_id, d.name, d.input_type, d.frequency, d.source,
         d.time_of_day, d.due, d.paused,
         -- values only for me, or when shared "mit Werten"
         case when p_user_id = (select auth.uid()) or h.share_level = 'values' then d.value end,
         d.score, d.state
    from private.habit_days_judged(p_user_id, p_from, p_to, p_today, p_time_zone) d
    join public.habits h on h.id = d.habit_id
   where p_user_id = (select auth.uid())
      or (h.share_level <> 'private' and private.can_view_user_data(p_user_id, 'habits'))
   order by d.on_date, d.habit_id;
$$;

create or replace function public.habit_weeks(
  p_user_id uuid,
  p_from date,
  p_to date,
  p_today date default current_date,
  p_time_zone text default 'Europe/Berlin'
)
returns table (
  habit_id uuid,
  week_start date,
  done_days integer,
  target integer,
  state text
)
language sql
stable
security definer
set search_path = ''
as $$
  select w.habit_id, w.week_start, w.done_days, w.target, w.state
    from private.habit_weeks_judged(p_user_id, p_from, p_to, p_today, p_time_zone) w
    join public.habits h on h.id = w.habit_id
   where p_user_id = (select auth.uid())
      or (h.share_level <> 'private' and private.can_view_user_data(p_user_id, 'habits'))
   order by w.week_start, w.habit_id;
$$;

revoke all on function private.habit_week_target(numeric, integer) from public, anon, authenticated;
revoke all on function private.habit_days_judged(uuid, date, date, date, text) from public, anon, authenticated;
revoke all on function private.habit_weeks_judged(uuid, date, date, date, text) from public, anon, authenticated;
