-- Baustein 6a: habits (personal module "habits"; works without groups, rule 13).
--
-- A habit is a definition with versions ("gültig ab"): an entry is judged by the version
-- valid on its day, so changing a rule never rewrites the past. Entries remember where they
-- came from (by hand, from the app, from outside). Sport comes from trainings by itself and
-- is never entered. Pauses (ill, holiday) count neither way: daily habits are not due on
-- those days, weekly targets shrink with the free days. Everything is judged in SQL.
-- Private for now; sharing per habit comes with the social part (6d).

-- ---------------------------------------------------------------------------
-- Settings as data
-- ---------------------------------------------------------------------------
create table public.habit_input_types (
  key text primary key,
  label text not null,
  sort integer not null default 0
);
insert into public.habit_input_types (key, label, sort) values
  ('yes_no', 'Ja/Nein', 10),
  ('number', 'Zahl mit Einheit', 20),
  ('duration', 'Dauer', 30),
  ('time_pair', 'Uhrzeit-Paar', 40),
  ('choice', 'Auswahl', 50),
  ('checklist', 'Checkliste', 60);

-- The fields a definition is made of (template and version alike):
--   input_type, unit, rule (jsonb list of conditions, see private.habit_score),
--   frequency daily | weekdays | weekly, weekdays (ISO 1–7), times_per_week,
--   time_of_day morning | evening, options (choice: [{key,label,score}],
--   checklist: [{key,label}]), source manual | training | external
create table public.habit_templates (
  id uuid primary key default gen_random_uuid(),
  key text unique,
  name text not null check (char_length(name) between 1 and 60),
  description text,
  input_type text not null references public.habit_input_types (key),
  unit text,
  rule jsonb not null default '[]',
  frequency text not null default 'daily' check (frequency in ('daily', 'weekdays', 'weekly')),
  weekdays smallint[] not null default '{}',
  times_per_week smallint check (times_per_week between 1 and 7),
  time_of_day text not null default 'evening' check (time_of_day in ('morning', 'evening')),
  options jsonb not null default '[]',
  source text not null default 'manual' check (source in ('manual', 'training', 'external')),
  sort integer not null default 0
);

insert into public.habit_templates
  (key, name, description, input_type, unit, rule, frequency, times_per_week, time_of_day, options, source, sort)
values
  ('sport', 'Sport', 'Zählt deine Trainings – nichts einzutragen.', 'yes_no', null, '[]',
   'weekly', 4, 'evening', '[]', 'training', 10),
  ('sleep', 'Schlaf', 'Ins Bett und aufgestanden.', 'time_pair', null,
   '[{"field":"duration","op":"min","value":420},{"field":"start","op":"before","value":"23:15"}]',
   'daily', null, 'morning', '[]', 'manual', 20),
  ('screen_time', 'Screen-Time', 'Handyzeit am Tag.', 'duration', null,
   '[{"op":"max","value":120}]', 'daily', null, 'evening', '[]', 'manual', 30),
  ('focus', 'Fokuszeit', 'Konzentriert gearbeitet oder gelernt.', 'duration', null,
   '[{"op":"min","value":120}]', 'daily', null, 'evening', '[]', 'manual', 40),
  ('nutrition', 'Ernährung', 'Wie gut hast du dich an deinen Plan gehalten?', 'choice', null, '[]',
   'daily', null, 'evening',
   '[{"key":"held","label":"Gehalten","score":1},{"key":"partly","label":"Teilweise","score":0.5},{"key":"not","label":"Nicht gehalten","score":0}]',
   'manual', 50),
  ('supplements', 'Supplements', 'Abhaken, was du genommen hast.', 'checklist', null, '[]',
   'daily', null, 'morning',
   '[{"key":"creatine","label":"Kreatin"},{"key":"vitamin_d","label":"Vitamin D"}]', 'manual', 60),
  ('steps', 'Schritte', null, 'number', 'Schritte', '[{"op":"min","value":8000}]',
   'daily', null, 'evening', '[]', 'manual', 70),
  ('water', 'Wasser', null, 'number', 'l', '[{"op":"min","value":2}]',
   'daily', null, 'evening', '[]', 'manual', 80),
  ('no_alcohol', 'Kein Alkohol', null, 'yes_no', null, '[]',
   'daily', null, 'evening', '[]', 'manual', 90);

-- ---------------------------------------------------------------------------
-- Habits, versions, entries, pauses
-- ---------------------------------------------------------------------------
create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The template it came from (same template = comparable values later).
  template_id uuid references public.habit_templates (id) on delete set null,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
create index habits_user_idx on public.habits (user_id);

create table public.habit_versions (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits (id) on delete cascade,
  valid_from date not null,
  name text not null check (char_length(name) between 1 and 60),
  input_type text not null references public.habit_input_types (key),
  unit text check (unit is null or char_length(unit) <= 20),
  rule jsonb not null default '[]',
  frequency text not null check (frequency in ('daily', 'weekdays', 'weekly')),
  weekdays smallint[] not null default '{}',
  times_per_week smallint check (times_per_week between 1 and 7),
  time_of_day text not null check (time_of_day in ('morning', 'evening')),
  options jsonb not null default '[]',
  source text not null check (source in ('manual', 'training', 'external')),
  created_at timestamptz not null default now(),
  unique (habit_id, valid_from),
  check (frequency <> 'weekly' or times_per_week is not null),
  check (frequency <> 'weekdays' or cardinality(weekdays) > 0)
);

create table public.habit_entries (
  habit_id uuid not null references public.habits (id) on delete cascade,
  on_date date not null,
  value jsonb not null,
  -- manual (check-in) | external (later through a personal key)
  source text not null default 'manual' check (source in ('manual', 'external')),
  updated_at timestamptz not null default now(),
  primary key (habit_id, on_date)
);

create table public.habit_pauses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  from_date date not null,
  to_date date not null,
  note text check (note is null or char_length(note) <= 100),
  created_at timestamptz not null default now(),
  check (to_date >= from_date)
);
create index habit_pauses_user_idx on public.habit_pauses (user_id, from_date);

-- Private: only the owner (sharing per habit comes in 6d through can_view_user_data).
alter table public.habit_input_types enable row level security;
alter table public.habit_templates enable row level security;
alter table public.habits enable row level security;
alter table public.habit_versions enable row level security;
alter table public.habit_entries enable row level security;
alter table public.habit_pauses enable row level security;
revoke all on public.habit_input_types, public.habit_templates, public.habits,
  public.habit_versions, public.habit_entries, public.habit_pauses from anon, authenticated;
grant select on public.habit_input_types, public.habit_templates, public.habits,
  public.habit_versions, public.habit_entries to authenticated;
grant select, insert, update, delete on public.habit_pauses to authenticated;
grant update (sort) on public.habits to authenticated;

create policy "habit_input_types: everyone reads" on public.habit_input_types
  for select to authenticated using (true);
create policy "habit_templates: everyone reads" on public.habit_templates
  for select to authenticated using (true);
create policy "habits: own" on public.habits
  for select to authenticated using (user_id = (select auth.uid()));
create policy "habits: own order" on public.habits
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "habit_versions: own" on public.habit_versions
  for select to authenticated
  using (exists (select 1 from public.habits h where h.id = habit_id and h.user_id = (select auth.uid())));
create policy "habit_entries: own" on public.habit_entries
  for select to authenticated
  using (exists (select 1 from public.habits h where h.id = habit_id and h.user_id = (select auth.uid())));
create policy "habit_pauses: own" on public.habit_pauses
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Judging
-- ---------------------------------------------------------------------------

-- "23:15" → minutes after midnight
create function private.habit_minutes(p_time text)
returns integer
language sql
immutable
as $$
  select split_part(p_time, ':', 1)::integer * 60 + split_part(p_time, ':', 2)::integer;
$$;

-- How far an entry meets its version, 0 … 1.
--   yes_no {done}                → 1 / 0
--   number {value}, duration {minutes} → 1 if every condition holds
--   time_pair {start, end}       → conditions on field duration (minutes), start or end
--   choice {choice}              → the option's score
--   checklist {checked: [keys]}  → share of the items ticked
-- Conditions: {op: min|max|between|before|after, value, value2, field?}
create function private.habit_score(p_version public.habit_versions, p_value jsonb)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_cond jsonb;
  v_actual numeric;
  v_target numeric;
  v_start integer;
  v_end integer;
  v_total integer;
begin
  case p_version.input_type
    when 'yes_no' then
      return case when (p_value ->> 'done')::boolean then 1 else 0 end;
    when 'choice' then
      return coalesce((select (o ->> 'score')::numeric from jsonb_array_elements(p_version.options) o
                        where o ->> 'key' = p_value ->> 'choice'), 0);
    when 'checklist' then
      v_total := jsonb_array_length(p_version.options);
      if v_total = 0 then
        return 0;
      end if;
      return least(1, (select count(*) from jsonb_array_elements(p_version.options) o
                        where p_value -> 'checked' ? (o ->> 'key'))::numeric / v_total);
    else
      for v_cond in select * from jsonb_array_elements(p_version.rule)
      loop
        if p_version.input_type = 'time_pair' then
          v_start := private.habit_minutes(p_value ->> 'start');
          v_end := private.habit_minutes(p_value ->> 'end');
          if v_cond ->> 'field' = 'start' then
            -- Before midnight counts as early, after midnight as late ("vor 23:15").
            v_actual := case when v_start < 12 * 60 then v_start + 24 * 60 else v_start end;
          elsif v_cond ->> 'field' = 'end' then
            v_actual := v_end;
          else
            v_actual := (v_end - v_start + 24 * 60) % (24 * 60);
          end if;
        elsif p_version.input_type = 'duration' then
          v_actual := (p_value ->> 'minutes')::numeric;
        else
          v_actual := (p_value ->> 'value')::numeric;
        end if;
        if v_cond ->> 'op' in ('before', 'after') then
          v_target := private.habit_minutes(v_cond ->> 'value');
          if v_cond ->> 'field' = 'start' and v_target < 12 * 60 then
            v_target := v_target + 24 * 60;
          end if;
        else
          v_target := (v_cond ->> 'value')::numeric;
        end if;
        if v_actual is null
           or (v_cond ->> 'op' = 'min' and v_actual < v_target)
           or (v_cond ->> 'op' = 'max' and v_actual > v_target)
           or (v_cond ->> 'op' = 'between'
               and (v_actual < v_target or v_actual > (v_cond ->> 'value2')::numeric))
           or (v_cond ->> 'op' = 'before' and v_actual >= v_target)
           or (v_cond ->> 'op' = 'after' and v_actual <= v_target) then
          return 0;
        end if;
      end loop;
      return 1;
  end case;
end;
$$;

-- An entry's value must fit its input type.
create function private.habit_value_ok(p_input_type text, p_value jsonb)
returns boolean
language sql
immutable
as $$
  select coalesce(case p_input_type
    when 'yes_no' then jsonb_typeof(p_value -> 'done') = 'boolean'
    when 'number' then jsonb_typeof(p_value -> 'value') = 'number'
    when 'duration' then jsonb_typeof(p_value -> 'minutes') = 'number' and (p_value ->> 'minutes')::numeric >= 0
    when 'time_pair' then (p_value ->> 'start') ~ '^\d{2}:\d{2}$' and (p_value ->> 'end') ~ '^\d{2}:\d{2}$'
    when 'choice' then jsonb_typeof(p_value -> 'choice') = 'string'
    when 'checklist' then jsonb_typeof(p_value -> 'checked') = 'array'
    else false
  end, false);
$$;

-- Each day of each habit of a person in a range: the version valid then, whether it was
-- due, paused, its entry and how far it was met.
--   state: done | partial | missed | open (today or later, nothing yet) | paused
--          | null (weekly habits: judged per week, see habit_weeks)
create function public.habit_days(
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
             when j.on_date >= p_today then 'open'
             else 'missed'
           end
         end as state
    from judged j
   order by j.on_date, j.habit_id;
$$;

-- Weekly habits per ISO week: done days, the target (shrunk by pause days: target × free
-- days / 7, rounded up) and the state. A week that is all pause does not count.
--   state: done | open (week not over) | missed | paused
create function public.habit_weeks(
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
  with days as (
    select * from public.habit_days(
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
         ceil(w.times_per_week * w.free_days / 7.0)::integer as target,
         case
           when w.free_days = 0 then 'paused'
           when w.done_days >= ceil(w.times_per_week * w.free_days / 7.0) then 'done'
           when w.week_start + 6 >= p_today then 'open'
           else 'missed'
         end
    from weeks w
   order by w.week_start, w.habit_id;
$$;

-- ---------------------------------------------------------------------------
-- Writing (one way in for check-in, app and later outside sources)
-- ---------------------------------------------------------------------------

-- Creates a habit (from a template or not) or changes it from a day on. p_def holds the
-- definition fields (see habit_templates); missing ones come from the template.
create function public.save_habit(
  p_habit_id uuid,
  p_template_id uuid,
  p_valid_from date,
  p_def jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_habit uuid := p_habit_id;
  v_t public.habit_templates%rowtype;
  -- The current definition: fields not given keep their value.
  v_b public.habit_versions%rowtype;
  v_first date;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_template_id is not null then
    select * into v_t from public.habit_templates where id = p_template_id;
    if not found then
      raise exception 'template_not_found' using errcode = 'P0001';
    end if;
  end if;

  if v_habit is null then
    insert into public.habits (user_id, template_id, sort)
    values (auth.uid(), p_template_id,
            coalesce((select max(sort) + 1 from public.habits where user_id = auth.uid()), 0))
    returning id into v_habit;
  elsif not exists (select 1 from public.habits where id = v_habit and user_id = auth.uid()) then
    raise exception 'habit_not_found' using errcode = '42501';
  end if;

  -- A change never reaches before the habit began.
  select min(valid_from) into v_first from public.habit_versions where habit_id = v_habit;
  select * into v_b from public.habit_versions
   where habit_id = v_habit and valid_from <= greatest(p_valid_from, coalesce(v_first, p_valid_from))
   order by valid_from desc limit 1;
  insert into public.habit_versions
    (habit_id, valid_from, name, input_type, unit, rule, frequency, weekdays, times_per_week,
     time_of_day, options, source)
  values (
    v_habit,
    greatest(p_valid_from, coalesce(v_first, p_valid_from)),
    coalesce(p_def ->> 'name', v_b.name, v_t.name),
    coalesce(p_def ->> 'input_type', v_b.input_type, v_t.input_type),
    case when p_def ? 'unit' then nullif(p_def ->> 'unit', '') else coalesce(v_b.unit, v_t.unit) end,
    coalesce(p_def -> 'rule', v_b.rule, v_t.rule, '[]'),
    coalesce(p_def ->> 'frequency', v_b.frequency, v_t.frequency, 'daily'),
    coalesce((select array_agg(x::smallint) from jsonb_array_elements_text(p_def -> 'weekdays') x),
             v_b.weekdays, v_t.weekdays, '{}'),
    case when p_def ? 'times_per_week' then (p_def ->> 'times_per_week')::smallint
         else coalesce(v_b.times_per_week, v_t.times_per_week) end,
    coalesce(p_def ->> 'time_of_day', v_b.time_of_day, v_t.time_of_day, 'evening'),
    coalesce(p_def -> 'options', v_b.options, v_t.options, '[]'),
    coalesce(p_def ->> 'source', v_b.source, v_t.source, 'manual'))
  on conflict (habit_id, valid_from) do update set
    name = excluded.name, input_type = excluded.input_type, unit = excluded.unit,
    rule = excluded.rule, frequency = excluded.frequency, weekdays = excluded.weekdays,
    times_per_week = excluded.times_per_week, time_of_day = excluded.time_of_day,
    options = excluded.options, source = excluded.source;
  return v_habit;
end;
$$;

-- Archive (no longer asked, history stays) or bring back.
create function public.archive_habit(p_habit_id uuid, p_archive boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.habits set archived_at = case when p_archive then now() end
   where id = p_habit_id and user_id = (select auth.uid());
$$;

-- An entry for a day (or, with null, none). Habits fed from trainings take no entries.
create function public.set_habit_entry(
  p_habit_id uuid,
  p_on_date date,
  p_value jsonb,
  p_source text default 'manual'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version public.habit_versions%rowtype;
begin
  if not exists (select 1 from public.habits where id = p_habit_id and user_id = auth.uid()) then
    raise exception 'habit_not_found' using errcode = '42501';
  end if;
  select * into v_version from public.habit_versions
   where habit_id = p_habit_id and valid_from <= p_on_date
   order by valid_from desc limit 1;
  if not found then
    raise exception 'habit_not_started' using errcode = 'P0001';
  end if;
  if v_version.source = 'training' then
    raise exception 'habit_from_trainings' using errcode = 'P0001';
  end if;
  if p_source not in ('manual', 'external') then
    raise exception 'invalid_source' using errcode = 'P0001';
  end if;
  if p_value is null then
    delete from public.habit_entries where habit_id = p_habit_id and on_date = p_on_date;
    return;
  end if;
  if not private.habit_value_ok(v_version.input_type, p_value) then
    raise exception 'invalid_value' using errcode = 'P0001';
  end if;
  insert into public.habit_entries (habit_id, on_date, value, source)
  values (p_habit_id, p_on_date, p_value, p_source)
  on conflict (habit_id, on_date) do update
    set value = excluded.value, source = excluded.source, updated_at = now();
end;
$$;

revoke all on function public.habit_days(uuid, date, date, date, text) from public, anon;
revoke all on function public.habit_weeks(uuid, date, date, date, text) from public, anon;
revoke all on function public.save_habit(uuid, uuid, date, jsonb) from public, anon;
revoke all on function public.archive_habit(uuid, boolean) from public, anon;
revoke all on function public.set_habit_entry(uuid, date, jsonb, text) from public, anon;
grant execute on function public.habit_days(uuid, date, date, date, text) to authenticated;
grant execute on function public.habit_weeks(uuid, date, date, date, text) to authenticated;
grant execute on function public.save_habit(uuid, uuid, date, jsonb) to authenticated;
grant execute on function public.archive_habit(uuid, boolean) to authenticated;
grant execute on function public.set_habit_entry(uuid, date, jsonb, text) to authenticated;
