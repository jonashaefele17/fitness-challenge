-- An answer that does not meet the habit ("Nein" at Kein Alkohol, "Nicht gehalten") is
-- missed, also today; only a day without an answer is still open.

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
    select d.on_date, v.*
      from public.habits h
      cross join days d
      cross join lateral (
        select * from public.habit_versions v
         where v.habit_id = h.id and v.valid_from <= d.on_date
         order by v.valid_from desc limit 1
      ) v
     where h.user_id = p_user_id
       and p_user_id = (select auth.uid())
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
