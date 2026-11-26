-- Baustein 7a: body weight (personal module "body"; works without groups, rule 13).
--
-- A person weighs on one or more scales. One is the main scale; every other scale has an
-- offset: how much MORE it shows than the main scale. What was entered stays stored as
-- entered; day values, trend and change are computed in SQL with the offsets applied
-- (rule 6). Several entries per day are allowed; the day counts with their average.
-- Strictly private in this stage: sharing with the group comes with 7b. The functions ask
-- private.can_view_body (the one place to widen later), the tables only the owner.

-- ---------------------------------------------------------------------------
-- Scales
-- ---------------------------------------------------------------------------
create table public.scales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  -- Set by the database: the first scale, then only through set_main_scale.
  is_main boolean not null default false,
  -- What this scale shows more than the main scale (main: always 0).
  offset_kg numeric(4, 2) not null default 0 check (offset_kg between -20 and 20),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  check (not is_main or offset_kg = 0),
  -- Target of the weigh-ins' (scale_id, user_id) key: a scale of the same person only.
  unique (id, user_id)
);
create index scales_user_idx on public.scales (user_id);
-- At most one main scale in use per person.
create unique index scales_one_main_idx on public.scales (user_id)
  where is_main and archived_at is null;

-- ---------------------------------------------------------------------------
-- Weigh-ins
-- ---------------------------------------------------------------------------
create table public.weigh_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- null: no scale given, counts as the main scale
  scale_id uuid,
  -- The local day it counts for (the phone's day).
  measured_on date not null,
  measured_at timestamptz not null default now(),
  -- As shown on the scale.
  weight_kg numeric(5, 2) not null check (weight_kg between 20 and 400),
  -- manual (entered) | external (later through a personal key), as for habit entries
  source text not null default 'manual' check (source in ('manual', 'external')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (scale_id, user_id) references public.scales (id, user_id)
);
create index weigh_ins_user_day_idx on public.weigh_ins (user_id, measured_on);
create index weigh_ins_scale_idx on public.weigh_ins (scale_id);

create trigger weigh_ins_set_updated_at
  before update on public.weigh_ins
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Settings (one row per person; later stages add columns)
-- ---------------------------------------------------------------------------
create table public.body_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  -- ISO weekdays 1 (Monday) … 7 (Sunday) to be reminded on; empty: no reminder
  weigh_reminder_days smallint[] not null default '{}'
    check (weigh_reminder_days <@ '{1,2,3,4,5,6,7}'::smallint[]),
  weigh_reminder_at time,
  updated_at timestamptz not null default now()
);

create trigger body_settings_set_updated_at
  before update on public.body_settings
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Access: only the owner (7b widens the functions, not these policies)
-- ---------------------------------------------------------------------------
alter table public.scales enable row level security;
alter table public.weigh_ins enable row level security;
alter table public.body_settings enable row level security;
revoke all on public.scales, public.weigh_ins, public.body_settings from anon, authenticated;
grant select on public.scales, public.weigh_ins to authenticated;
-- Main scale only through set_main_scale; no delete (archive instead).
grant insert (id, name, offset_kg) on public.scales to authenticated;
grant update (name, offset_kg, archived_at) on public.scales to authenticated;
-- id on insert: undoing a delete puts the same entry back.
grant insert (id, scale_id, measured_on, measured_at, weight_kg, source) on public.weigh_ins to authenticated;
grant update (scale_id, measured_on, measured_at, weight_kg, source) on public.weigh_ins to authenticated;
grant delete on public.weigh_ins to authenticated;
grant select, insert, update, delete on public.body_settings to authenticated;

create policy "scales: own" on public.scales
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "weigh_ins: own" on public.weigh_ins
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "body_settings: own" on public.body_settings
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Keeping the main scale consistent
-- ---------------------------------------------------------------------------

-- Makes a scale the main one. Offsets are relative to the main scale, so all of the
-- person's offsets move by the new main's old offset (new main: 0). Entries without a
-- scale belonged to the old main; they are pinned to it first so they keep their meaning.
create function private.rebase_scales(p_user_id uuid, p_new_main uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shift numeric;
  v_old_main uuid;
begin
  select offset_kg into v_shift from public.scales where id = p_new_main and user_id = p_user_id;
  select id into v_old_main from public.scales
   where user_id = p_user_id and is_main and archived_at is null;
  if v_old_main is not null and v_old_main <> p_new_main then
    update public.weigh_ins set scale_id = v_old_main
     where user_id = p_user_id and scale_id is null;
  end if;
  -- Two steps: the one-main index is checked row by row.
  update public.scales set is_main = false
   where user_id = p_user_id and is_main and id <> p_new_main;
  update public.scales set offset_kg = offset_kg - v_shift, is_main = (id = p_new_main)
   where user_id = p_user_id;
end;
$$;

-- The first scale (or the first while none is main) becomes the main scale; the main
-- scale is set by the database only.
create function private.on_scale_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.scales s
              where s.user_id = new.user_id and s.is_main and s.archived_at is null) then
    new.is_main := false;
  else
    new.is_main := true;
    new.offset_kg := 0;
  end if;
  return new;
end;
$$;

create trigger scales_before_insert
  before insert on public.scales
  for each row execute function private.on_scale_insert();

-- Archiving: the main scale only when no other scale is in use (make another one main
-- first). Bringing a scale back while none is main makes it the main one.
create function private.on_scale_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.archived_at is not null and old.archived_at is null and old.is_main then
    if exists (select 1 from public.scales s
                where s.user_id = new.user_id and s.id <> new.id and s.archived_at is null) then
      raise exception 'main_scale_in_use' using errcode = 'P0001';
    end if;
  elsif new.archived_at is null and old.archived_at is not null then
    if exists (select 1 from public.scales s
                where s.user_id = new.user_id and s.id <> new.id
                  and s.is_main and s.archived_at is null) then
      new.is_main := false;
    else
      -- Re-base the others (all archived) on this one.
      update public.scales set offset_kg = offset_kg - new.offset_kg, is_main = false
       where user_id = new.user_id and id <> new.id;
      new.is_main := true;
      new.offset_kg := 0;
    end if;
  end if;
  return new;
end;
$$;

create trigger scales_before_update
  before update on public.scales
  for each row execute function private.on_scale_update();

create function public.set_main_scale(p_scale_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.scales
                  where id = p_scale_id and user_id = auth.uid() and archived_at is null) then
    raise exception 'scale_not_found' using errcode = '42501';
  end if;
  perform private.rebase_scales(auth.uid(), p_scale_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Computed: day values, trend, change, offset suggestion
-- ---------------------------------------------------------------------------

-- Who may read a person's body figures. The one place 7b widens
-- (private.can_view_user_data(p_owner, 'body') plus the person's share level).
create function private.can_view_body(p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_owner = (select auth.uid());
$$;

-- One row per day with entries in the range (p_from null: from the first entry):
--   weight_kg: average of the day's entries, each with its scale's offset taken off
--   trend_kg:  average of the day values of the 7 days ending that day (days with
--              entries only; days before p_from count as well)
create function public.weight_days(p_user_id uuid, p_from date, p_to date)
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
       and private.can_view_body(p_user_id)
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

-- The figures of a range (always one row; nulls and 0 days without data):
--   current: trend of the latest day with entries, start: trend of the first one,
--   change in kg and % (of the start), latest single entry (as entered, its scale and
--   with the offset taken off), number of days with entries.
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
  days_with_entries integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with d as (
    select * from public.weight_days(p_user_id, p_from, p_to)
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
  select cur.trend_kg,
         cur.on_date,
         st.trend_kg,
         st.on_date,
         cur.trend_kg - st.trend_kg,
         round((cur.trend_kg - st.trend_kg) / nullif(st.trend_kg, 0) * 100, 2),
         latest.weight_kg,
         latest.adjusted,
         latest.scale_id,
         latest.measured_on,
         (select count(*)::integer from d)
    from (select 1) one
    left join cur on true
    left join st on true
    left join latest on true;
$$;

-- For one of my scales that is not the main one: the average difference (this scale −
-- main scale, as entered) over the days I weighed on both, and how many such days.
-- No row for other people's scales or the main scale; null and 0 without common days.
create function public.scale_offset_suggestion(p_scale_id uuid)
returns table (
  scale_id uuid,
  suggested_offset_kg numeric,
  common_days integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with s as (
    select sc.id, sc.user_id from public.scales sc
     where sc.id = p_scale_id and sc.user_id = (select auth.uid()) and not sc.is_main
  ),
  m as (
    select sc.id from public.scales sc, s
     where sc.user_id = s.user_id and sc.is_main and sc.archived_at is null
  ),
  pairs as (
    select w.measured_on,
           avg(w.weight_kg) filter (where w.scale_id = s.id) as this_kg,
           avg(w.weight_kg) filter (where w.scale_id is null or w.scale_id = (select m.id from m)) as main_kg
      from public.weigh_ins w, s
     where w.user_id = s.user_id
     group by w.measured_on
  )
  select s.id,
         round((select avg(p.this_kg - p.main_kg) from pairs p
                 where p.this_kg is not null and p.main_kg is not null), 2),
         (select count(*)::integer from pairs p
           where p.this_kg is not null and p.main_kg is not null)
    from s;
$$;

revoke all on function private.rebase_scales(uuid, uuid) from public, anon, authenticated;
revoke all on function private.can_view_body(uuid) from public, anon, authenticated;
revoke all on function public.set_main_scale(uuid) from public, anon;
revoke all on function public.weight_days(uuid, date, date) from public, anon;
revoke all on function public.weight_summary(uuid, date, date) from public, anon;
revoke all on function public.scale_offset_suggestion(uuid) from public, anon;
grant execute on function public.set_main_scale(uuid) to authenticated;
grant execute on function public.weight_days(uuid, date, date) to authenticated;
grant execute on function public.weight_summary(uuid, date, date) to authenticated;
grant execute on function public.scale_offset_suggestion(uuid) to authenticated;
