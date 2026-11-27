-- Baustein 7c (body, personal): the "Zwischenstand" – a check-in every few weeks with body
-- measurements (7d adds progress photos to the same check-in).
--   body_measurement_kinds: global catalogue as data (rule 5), read-only for clients.
--   body_checkins: one per person and day; a skipped one has no data and only moves the
--     rhythm on. Written through save_body_checkin / skip_body_checkin only (rule 14);
--     deleted directly (the UI undoes by saving it again).
--   body_measurements: the values of a check-in; ownership follows the check-in.
-- Rhythm status, per-kind figures and history are computed (rule 6). Strictly private: the
-- functions ask private.can_view_body (the one place to widen later), the tables the owner.
-- Nothing here references social tables (rule 13).

-- ---------------------------------------------------------------------------
-- Measurement kinds (global)
-- ---------------------------------------------------------------------------
create table public.body_measurement_kinds (
  key text primary key check (key ~ '^[a-z][a-z_]*$'),
  label text not null,
  -- How and where to measure (shown in the check-in flow).
  hint text not null,
  unit text not null default 'cm',
  -- Step of the minus/plus buttons.
  step numeric(3, 1) not null default 0.5 check (step > 0),
  sort smallint not null,
  -- Picture of where to measure (storage path); pictures come later.
  image_path text
);

insert into public.body_measurement_kinds (key, label, hint, unit, step, sort) values
  ('bauch', 'Bauch',
   'Auf Höhe des Bauchnabels, entspannt stehen, nach dem Ausatmen messen.', 'cm', 0.5, 10),
  ('taille', 'Taille',
   'An der schmalsten Stelle zwischen Rippen und Hüfte, nach dem Ausatmen.', 'cm', 0.5, 20),
  ('brust', 'Brust',
   'Auf Höhe der Brustwarzen, Arme locker hängen lassen, normal atmen.', 'cm', 0.5, 30),
  ('huefte', 'Hüfte',
   'An der breitesten Stelle über dem Gesäß, Füße zusammen.', 'cm', 0.5, 40),
  ('oberarm', 'Oberarm',
   'Angespannt an der dicksten Stelle. Immer derselbe Arm.', 'cm', 0.5, 50),
  ('oberschenkel', 'Oberschenkel',
   'Im Stehen in der Mitte zwischen Hüfte und Knie. Immer dasselbe Bein.', 'cm', 0.5, 60);

-- ---------------------------------------------------------------------------
-- Check-ins and their measurements
-- ---------------------------------------------------------------------------
create table public.body_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The local day it counts for.
  on_date date not null,
  -- Skipped for this time: no data, only moves the rhythm on.
  skipped boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, on_date)
);

create trigger body_checkins_set_updated_at
  before update on public.body_checkins
  for each row execute function private.set_updated_at();

create table public.body_measurements (
  checkin_id uuid not null references public.body_checkins (id) on delete cascade,
  kind text not null references public.body_measurement_kinds (key),
  value numeric(5, 1) not null check (value between 10 and 300),
  primary key (checkin_id, kind)
);
create index body_measurements_kind_idx on public.body_measurements (kind);

-- ---------------------------------------------------------------------------
-- Settings: rhythm, reminder time, kinds I do not measure
-- ---------------------------------------------------------------------------
alter table public.body_settings
  -- null: no rhythm (no Heute card, no reminder)
  add column checkin_every_weeks smallint check (checkin_every_weeks between 1 and 12),
  -- null: no push (the Heute card still shows when due)
  add column checkin_reminder_at time,
  add column hidden_measurement_kinds text[] not null default '{}';

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------
alter table public.body_measurement_kinds enable row level security;
alter table public.body_checkins enable row level security;
alter table public.body_measurements enable row level security;
revoke all on public.body_measurement_kinds, public.body_checkins, public.body_measurements
  from anon, authenticated;
grant select on public.body_measurement_kinds, public.body_checkins, public.body_measurements
  to authenticated;
-- Writing only through the functions below; deleting directly (cascades to the values).
grant delete on public.body_checkins to authenticated;

create policy "body_measurement_kinds: everyone reads" on public.body_measurement_kinds
  for select to authenticated using (true);
create policy "body_checkins: own" on public.body_checkins
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "body_measurements: own check-in" on public.body_measurements
  for all to authenticated
  using (exists (select 1 from public.body_checkins c
                  where c.id = checkin_id and c.user_id = (select auth.uid())))
  with check (exists (select 1 from public.body_checkins c
                       where c.id = checkin_id and c.user_id = (select auth.uid())));

-- ---------------------------------------------------------------------------
-- Saving
-- ---------------------------------------------------------------------------

-- Saves my check-in of a day with exactly these values ({"bauch": 84.5, …}; kinds not given
-- or null are removed; an empty object is a check-in without measurements, e.g. photos only
-- in 7d). Idempotent per day: a second save on the same day updates that check-in (also a
-- skipped one, which then counts as done). p_id: the client's id for a new check-in; if it
-- names one of my check-ins, that one is saved (and may move to p_on_date). Returns the id.
create function public.save_body_checkin(p_on_date date, p_values jsonb, p_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_kind text;
  v_value jsonb;
begin
  if v_user is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if p_on_date is null then
    raise exception 'date_required' using errcode = '22023';
  end if;
  if p_values is null or jsonb_typeof(p_values) <> 'object' then
    raise exception 'values_must_be_an_object' using errcode = '22023';
  end if;
  for v_kind, v_value in select * from jsonb_each(p_values) loop
    if not exists (select 1 from public.body_measurement_kinds k where k.key = v_kind) then
      raise exception 'unknown_measurement_kind: %', v_kind using errcode = '22023';
    end if;
    if jsonb_typeof(v_value) = 'null' then
      continue;
    end if;
    if jsonb_typeof(v_value) <> 'number' or (v_value #>> '{}')::numeric not between 10 and 300 then
      raise exception 'measurement_out_of_range: %', v_kind using errcode = '23514';
    end if;
  end loop;

  if p_id is not null then
    if exists (select 1 from public.body_checkins c where c.id = p_id and c.user_id <> v_user) then
      raise exception 'checkin_not_found' using errcode = '42501';
    end if;
    select c.id into v_id from public.body_checkins c where c.id = p_id;
  end if;
  if v_id is null then
    select c.id into v_id from public.body_checkins c
     where c.user_id = v_user and c.on_date = p_on_date;
  end if;

  if v_id is null then
    insert into public.body_checkins (id, user_id, on_date)
    values (coalesce(p_id, gen_random_uuid()), v_user, p_on_date)
    returning id into v_id;
  else
    begin
      update public.body_checkins set on_date = p_on_date, skipped = false, updated_at = now()
       where id = v_id;
    exception when unique_violation then
      raise exception 'checkin_exists_on_date' using errcode = '23505';
    end;
  end if;

  delete from public.body_measurements m
   where m.checkin_id = v_id
     and not exists (select 1 from jsonb_each(p_values) e
                      where e.key = m.kind and jsonb_typeof(e.value) <> 'null');
  insert into public.body_measurements (checkin_id, kind, value)
  select v_id, e.key, (e.value #>> '{}')::numeric
    from jsonb_each(p_values) e
   where jsonb_typeof(e.value) <> 'null'
  on conflict (checkin_id, kind) do update set value = excluded.value;

  return v_id;
end;
$$;

-- Skips the check-in of a day for this time: a skipped row (no data) that moves the rhythm
-- on. Does nothing when that day already has a check-in (a done one stays done). p_id: the
-- client's id for the new row. Returns the id of that day's check-in.
create function public.skip_body_checkin(p_on_date date, p_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
begin
  if v_user is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if p_on_date is null then
    raise exception 'date_required' using errcode = '22023';
  end if;
  select c.id into v_id from public.body_checkins c
   where c.user_id = v_user and c.on_date = p_on_date;
  if v_id is null then
    if p_id is not null and exists (select 1 from public.body_checkins c where c.id = p_id) then
      raise exception 'checkin_id_taken' using errcode = '23505';
    end if;
    insert into public.body_checkins (id, user_id, on_date, skipped)
    values (coalesce(p_id, gen_random_uuid()), v_user, p_on_date, true)
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Computed: rhythm status, figures per kind, history of a kind
-- ---------------------------------------------------------------------------

-- The rhythm maths without any access check (internal; callers check access; the reminder
-- uses it too). One row:
--   last_on: latest check-in (skipped ones included) · last_done_on: latest not skipped
--   every_weeks: the rhythm (null: none) · next_due_on: last_on + weeks, or p_today when
--   there is a rhythm but no check-in yet (the first one is the baseline) · due: rhythm set
--   and next_due_on <= p_today · days_until: next_due_on − p_today (negative: overdue;
--   null without rhythm)
create function private.body_checkin_rhythm(p_user_id uuid, p_today date)
returns table (
  last_on date,
  last_done_on date,
  every_weeks integer,
  next_due_on date,
  due boolean,
  days_until integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with c as (
    select max(c.on_date) as last_on,
           max(c.on_date) filter (where not c.skipped) as last_done_on
      from public.body_checkins c
     where c.user_id = p_user_id
  ),
  s as (
    select s.checkin_every_weeks::integer as weeks
      from public.body_settings s where s.user_id = p_user_id
  ),
  n as (
    select c.last_on, c.last_done_on, s.weeks,
           case when s.weeks is not null then coalesce(c.last_on + s.weeks * 7, p_today) end
             as next_due_on
      from c left join s on true
  )
  select n.last_on, n.last_done_on, n.weeks, n.next_due_on,
         coalesce(n.next_due_on <= p_today, false),
         n.next_due_on - p_today
    from n;
$$;

-- My rhythm status (one row; none for anyone else).
create function public.body_checkin_status(p_user_id uuid, p_today date)
returns table (
  last_on date,
  last_done_on date,
  every_weeks integer,
  next_due_on date,
  due boolean,
  days_until integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.* from private.body_checkin_rhythm(p_user_id, p_today) r
   where private.can_view_body(p_user_id);
$$;

-- Per kind with at least one value (hidden kinds included – the UI decides), in catalogue
-- order: the latest value, the one before, the first, the changes (null with one value)
-- and how many values there are.
create function public.body_measurement_stats(p_user_id uuid)
returns table (
  kind text,
  latest_value numeric,
  latest_on date,
  previous_value numeric,
  previous_on date,
  first_value numeric,
  first_on date,
  change_since_previous numeric,
  change_since_first numeric,
  value_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with v as (
    select m.kind, m.value, c.on_date,
           row_number() over (partition by m.kind order by c.on_date desc) as back,
           row_number() over (partition by m.kind order by c.on_date) as fwd,
           count(*) over (partition by m.kind) as n
      from public.body_measurements m
      join public.body_checkins c on c.id = m.checkin_id
     where c.user_id = p_user_id
       and not c.skipped
       and private.can_view_body(p_user_id)
  ),
  per as (
    select v.kind,
           max(v.value) filter (where v.back = 1) as latest_value,
           max(v.on_date) filter (where v.back = 1) as latest_on,
           max(v.value) filter (where v.back = 2) as previous_value,
           max(v.on_date) filter (where v.back = 2) as previous_on,
           max(v.value) filter (where v.fwd = 1) as first_value,
           max(v.on_date) filter (where v.fwd = 1) as first_on,
           max(v.n)::integer as value_count
      from v
     group by v.kind
  )
  select p.kind, p.latest_value, p.latest_on, p.previous_value, p.previous_on,
         p.first_value, p.first_on,
         p.latest_value - p.previous_value,
         case when p.value_count > 1 then p.latest_value - p.first_value end,
         p.value_count
    from per p
    join public.body_measurement_kinds k on k.key = p.kind
   order by k.sort;
$$;

-- All values of a kind, oldest first, with the check-in they belong to.
create function public.body_measurement_history(p_user_id uuid, p_kind text)
returns table (
  on_date date,
  value numeric,
  checkin_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.on_date, m.value, c.id
    from public.body_measurements m
    join public.body_checkins c on c.id = m.checkin_id
   where c.user_id = p_user_id
     and m.kind = p_kind
     and not c.skipped
     and private.can_view_body(p_user_id)
   order by c.on_date;
$$;

revoke all on function private.body_checkin_rhythm(uuid, date) from public, anon, authenticated;
revoke all on function public.save_body_checkin(date, jsonb, uuid) from public, anon;
revoke all on function public.skip_body_checkin(date, uuid) from public, anon;
revoke all on function public.body_checkin_status(uuid, date) from public, anon;
revoke all on function public.body_measurement_stats(uuid) from public, anon;
revoke all on function public.body_measurement_history(uuid, text) from public, anon;
grant execute on function public.save_body_checkin(date, jsonb, uuid) to authenticated;
grant execute on function public.skip_body_checkin(date, uuid) to authenticated;
grant execute on function public.body_checkin_status(uuid, date) to authenticated;
grant execute on function public.body_measurement_stats(uuid) to authenticated;
grant execute on function public.body_measurement_history(uuid, text) to authenticated;
