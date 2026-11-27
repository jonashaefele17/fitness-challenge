-- Baustein 8b (body, personal): my special days for the calendar and "Heute", computed from
-- my own rhythms (never stored). Only for me; nothing here knows of groups or seasons.
--   weigh_day:   each day in the range that is one of my weigh days (weigh_reminder_days)
--   checkin_due: the day my next Zwischenstand is due (private.body_checkin_rhythm); when it
--                is overdue (or the very first one), today
-- Ordered by day, then kind. The range is capped at about a year.

create function public.body_day_markers(p_from date, p_to date, p_today date default current_date)
returns table (
  on_date date,
  kind text
)
language sql
stable
security definer
set search_path = ''
as $$
  select d::date, 'weigh_day'::text
    from public.body_settings s
   cross join generate_series(p_from, p_to, interval '1 day') d
   where s.user_id = (select auth.uid())
     and p_to - p_from <= 400
     and extract(isodow from d)::smallint = any (s.weigh_reminder_days)
  union all
  select greatest(r.next_due_on, p_today), 'checkin_due'::text
    from private.body_checkin_rhythm((select auth.uid()), p_today) r
   where (select auth.uid()) is not null
     and r.next_due_on is not null
     and greatest(r.next_due_on, p_today) between p_from and p_to
  order by 1, 2;
$$;

revoke all on function public.body_day_markers(date, date, date) from public, anon;
grant execute on function public.body_day_markers(date, date, date) to authenticated;
