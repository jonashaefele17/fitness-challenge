-- Baustein 7b (body, personal): sharing the weight with the people one shares a group with.
-- Asked through private.can_view_user_data, never groups directly (rule 13).
--   private (default): nothing · percent: the change in % only · kg: also the trend in kg.
-- Others only ever get the 7-day trend: never single measurements, the scale or how many
-- entries there were. The masking happens here, not in the UI. One setting per person,
-- valid for all their groups. The tables stay owner-only; weight_days (day values and
-- entry counts) too.

alter table public.body_settings
  add column weight_share text not null default 'private'
    check (weight_share in ('private', 'percent', 'kg'));

-- What the current user may see of a person's weight:
--   'own' (it is me) · 'kg' · 'percent' · null (nothing: not shared, or no common group).
-- private.can_view_body stays the gate for everything beyond the trend (day values,
-- entries, single measurements, scales): the owner only.
create function private.weight_view(p_owner uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_owner = (select auth.uid()) then 'own'
    when private.can_view_user_data(p_owner, 'body') then
      (select nullif(s.weight_share, 'private') from public.body_settings s
        where s.user_id = p_owner)
  end;
$$;

-- The maths of weight_days without any access check (internal; callers check access):
--   weight_kg: average of the day's entries, each with its scale's offset taken off
--   trend_kg:  average of the day values of the 7 days ending that day (days with
--              entries only; days before p_from count as well)
create function private.weight_trend(p_user_id uuid, p_from date, p_to date)
returns table (
  on_date date,
  weight_kg numeric,
  entries integer,
  trend_kg numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with adjusted as (
    select w.measured_on, w.weight_kg - coalesce(s.offset_kg, 0) as kg
      from public.weigh_ins w
      left join public.scales s on s.id = w.scale_id
     where w.user_id = p_user_id
       and (p_from is null or w.measured_on >= p_from - 6)
       and w.measured_on <= p_to
  ),
  days as (
    select a.measured_on as on_date, avg(a.kg) as kg, count(*)::integer as entries
      from adjusted a
     group by a.measured_on
  )
  select d.on_date,
         round(d.kg, 2),
         d.entries,
         round((select avg(x.kg) from days x
                 where x.on_date between d.on_date - 6 and d.on_date), 2)
    from days d
   where p_from is null or d.on_date >= p_from
   order by d.on_date;
$$;

-- Day values: still the owner only.
create or replace function public.weight_days(p_user_id uuid, p_from date, p_to date)
returns table (
  on_date date,
  weight_kg numeric,
  entries integer,
  trend_kg numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.on_date, t.weight_kg, t.entries, t.trend_kg
    from private.weight_trend(p_user_id, p_from, p_to) t
   where private.can_view_body(p_user_id)
   order by t.on_date;
$$;

-- The curve of a range, for me and for people who share (p_from null: from the first
-- entry). One row per day with entries:
--   change_pct: that day's trend against the trend of the first day with entries in the
--               range, in % (first day: 0)
--   trend_kg:   only for me or when shared in kg
-- Nothing (no rows) for people who do not share.
create function public.weight_progress(p_user_id uuid, p_from date, p_to date)
returns table (
  on_date date,
  change_pct numeric,
  trend_kg numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with v as (
    select private.weight_view(p_user_id) as lvl
  ),
  d as (
    select t.on_date, t.trend_kg
      from v, private.weight_trend(p_user_id, p_from, p_to) t
     where v.lvl is not null
  ),
  st as (
    select d.trend_kg from d order by d.on_date limit 1
  )
  select d.on_date,
         round((d.trend_kg - st.trend_kg) / nullif(st.trend_kg, 0) * 100, 2),
         case when v.lvl in ('own', 'kg') then d.trend_kg end
    from d, st, v
   order by d.on_date;
$$;

-- The figures of a range (always one row). For me: everything as before, share 'own'.
-- For others, masked by what they share:
--   kg:      current/start trend, change in kg and %, the days they belong to
--   percent: change in % and the days only
--   not shared (or no common group): all null, exactly like a person without data
-- The latest single entry and its scale are mine only; days_with_entries is 0 for others.
-- share: 'own' | 'kg' | 'percent' | null (nothing to see).
drop function public.weight_summary(uuid, date, date);
create function public.weight_summary(p_user_id uuid, p_from date, p_to date)
returns table (
  current_trend_kg numeric,
  current_on date,
  start_trend_kg numeric,
  start_on date,
  change_kg numeric,
  change_pct numeric,
  latest_kg numeric,
  latest_adjusted_kg numeric,
  latest_scale_id uuid,
  latest_on date,
  days_with_entries integer,
  share text
)
language sql
stable
security definer
set search_path = ''
as $$
  with v as (
    select private.weight_view(p_user_id) as lvl
  ),
  d as (
    select t.on_date, t.trend_kg
      from v, private.weight_trend(p_user_id, p_from, p_to) t
     where v.lvl is not null
  ),
  cur as (select d.on_date, d.trend_kg from d order by d.on_date desc limit 1),
  st as (select d.on_date, d.trend_kg from d order by d.on_date limit 1),
  latest as (
    select w.weight_kg, w.weight_kg - coalesce(s.offset_kg, 0) as adjusted, w.scale_id,
           w.measured_on
      from public.weigh_ins w
      left join public.scales s on s.id = w.scale_id
     where w.user_id = p_user_id
       and private.can_view_body(p_user_id)
       and (p_from is null or w.measured_on >= p_from)
       and w.measured_on <= p_to
     order by w.measured_on desc, w.measured_at desc, w.created_at desc
     limit 1
  )
  select case when v.lvl in ('own', 'kg') then cur.trend_kg end,
         cur.on_date,
         case when v.lvl in ('own', 'kg') then st.trend_kg end,
         st.on_date,
         case when v.lvl in ('own', 'kg') then cur.trend_kg - st.trend_kg end,
         round((cur.trend_kg - st.trend_kg) / nullif(st.trend_kg, 0) * 100, 2),
         latest.weight_kg,
         latest.adjusted,
         latest.scale_id,
         latest.measured_on,
         case when v.lvl = 'own' then (select count(*)::integer from d) else 0 end,
         v.lvl
    from v
    left join cur on true
    left join st on true
    left join latest on true;
$$;

revoke all on function private.weight_view(uuid) from public, anon, authenticated;
revoke all on function private.weight_trend(uuid, date, date) from public, anon, authenticated;
revoke all on function public.weight_progress(uuid, date, date) from public, anon;
revoke all on function public.weight_summary(uuid, date, date) from public, anon;
grant execute on function public.weight_progress(uuid, date, date) to authenticated;
grant execute on function public.weight_summary(uuid, date, date) to authenticated;
