-- Baustein 7b (body, personal): a fourth share level, "days" – the group also sees the
-- unsmoothed day values in kg (the day's average with the scale offsets taken off).
--   private · percent · kg (7-day trend) · days (trend and day values)
-- Still mine only: single entries of a day, their times, the scales, how many entries.

alter table public.body_settings drop constraint body_settings_weight_share_check;
alter table public.body_settings
  add constraint body_settings_weight_share_check
    check (weight_share in ('private', 'percent', 'kg', 'days'));

-- weight_view needs no change: it hands on the person's level ('days' is new).

-- The curve: weight_kg (the day value) for me or when shared with days.
drop function public.weight_progress(uuid, date, date);
create function public.weight_progress(p_user_id uuid, p_from date, p_to date)
returns table (
  on_date date,
  change_pct numeric,
  trend_kg numeric,
  weight_kg numeric
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
    select t.on_date, t.trend_kg, t.weight_kg
      from v, private.weight_trend(p_user_id, p_from, p_to) t
     where v.lvl is not null
  ),
  st as (
    select d.trend_kg from d order by d.on_date limit 1
  )
  select d.on_date,
         round((d.trend_kg - st.trend_kg) / nullif(st.trend_kg, 0) * 100, 2),
         case when v.lvl in ('own', 'kg', 'days') then d.trend_kg end,
         case when v.lvl in ('own', 'days') then d.weight_kg end
    from d, st, v
   order by d.on_date;
$$;

-- The figures: "days" sees what "kg" sees (the latest single entry stays mine).
create or replace function public.weight_summary(p_user_id uuid, p_from date, p_to date)
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
  select case when v.lvl in ('own', 'kg', 'days') then cur.trend_kg end,
         cur.on_date,
         case when v.lvl in ('own', 'kg', 'days') then st.trend_kg end,
         st.on_date,
         case when v.lvl in ('own', 'kg', 'days') then cur.trend_kg - st.trend_kg end,
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

revoke all on function public.weight_progress(uuid, date, date) from public, anon;
grant execute on function public.weight_progress(uuid, date, date) to authenticated;
