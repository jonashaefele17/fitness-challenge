-- Training module, part 1: catalogue and personal training settings.
--
-- Personal module (CLAUDE.md rule 13): no group_id, no references to social tables,
-- people are referenced via auth.users. Visibility of other people's data only through
-- private.can_view_user_data(owner, 'training').
--
-- Global catalogue (shared by everyone, grows from what people actually do):
--   muscle_groups, exercises (+ aliases, muscles), locations (studios), devices.
-- Private: a location with owner_id (e.g. "Home Gym") and its devices, personal training
-- types, device settings and training preferences.

-- ---------------------------------------------------------------------------
-- Muscle groups (reference data)
-- ---------------------------------------------------------------------------
create table public.muscle_groups (
  key text primary key check (key ~ '^[a-z][a-z_]*$'),
  label text not null,
  sort integer not null
);

insert into public.muscle_groups (key, label, sort) values
  ('chest', 'Brust', 10),
  ('upper_back', 'Oberer Rücken', 20),
  ('lats', 'Latissimus', 30),
  ('shoulders', 'Schultern', 40),
  ('biceps', 'Bizeps', 50),
  ('triceps', 'Trizeps', 60),
  ('forearms', 'Unterarme', 70),
  ('abs', 'Bauch', 80),
  ('lower_back', 'Unterer Rücken', 90),
  ('glutes', 'Gesäß', 100),
  ('quads', 'Oberschenkel vorne', 110),
  ('hamstrings', 'Oberschenkel hinten', 120),
  ('calves', 'Waden', 130);

-- ---------------------------------------------------------------------------
-- Exercises
-- ---------------------------------------------------------------------------
create type public.exercise_measure as enum ('weight_reps', 'reps', 'duration');

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  -- weight_reps: kg × reps · reps: bodyweight reps (optional added weight) · duration: seconds
  measure public.exercise_measure not null,
  -- Storage path of the illustration (PNG/WebP with transparency), set in the catalogue editor.
  image_path text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Set when an admin merges a duplicate into another exercise (history stays valid).
  merged_into uuid references public.exercises (id)
);
create unique index exercises_name_unique_idx on public.exercises (lower(btrim(name)))
  where merged_into is null;

create table public.exercise_aliases (
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  alias text not null check (char_length(btrim(alias)) between 2 and 60),
  primary key (exercise_id, alias)
);
create unique index exercise_aliases_alias_unique_idx on public.exercise_aliases (lower(btrim(alias)));

create table public.exercise_muscles (
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  muscle_group text not null references public.muscle_groups (key),
  role text not null check (role in ('primary', 'secondary')),
  primary key (exercise_id, muscle_group)
);

-- ---------------------------------------------------------------------------
-- Locations and devices
-- ---------------------------------------------------------------------------
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  -- null: public studio for everyone · set: private place of one person (e.g. Home Gym)
  owner_id uuid references auth.users (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index locations_public_name_unique_idx on public.locations (lower(btrim(name)))
  where owner_id is null;

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 60),
  image_path text,
  -- Weight steps in kg: smallest increment and optional range (e.g. stack 5 kg, 5–100 kg).
  weight_step numeric(6, 2) check (weight_step is null or weight_step > 0),
  weight_min numeric(6, 2) check (weight_min is null or weight_min >= 0),
  weight_max numeric(6, 2),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint devices_weight_range check (weight_max is null or weight_min is null or weight_max >= weight_min)
);
create index devices_location_idx on public.devices (location_id);

create table public.device_exercises (
  device_id uuid not null references public.devices (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  primary key (device_id, exercise_id)
);

-- Per person, device and exercise, e.g. "Höhe 12" for triceps pushdown on the cable tower.
create table public.user_device_settings (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  device_id uuid not null references public.devices (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  setting text not null check (char_length(btrim(setting)) between 1 and 80),
  updated_at timestamptz not null default now(),
  primary key (user_id, device_id, exercise_id)
);

create trigger user_device_settings_set_updated_at
  before update on public.user_device_settings
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Training types (data): defaults for everyone plus personal ones
-- ---------------------------------------------------------------------------
create table public.training_types (
  id uuid primary key default gen_random_uuid(),
  -- null: default type for everyone · set: personal type
  owner_id uuid references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 40),
  -- exercises: logged with exercises and sets · duration: one entry with duration (± distance)
  kind text not null check (kind in ('exercises', 'duration')),
  with_distance boolean not null default false,
  sort integer not null default 100,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  constraint training_types_distance_only_for_duration check (kind = 'duration' or not with_distance)
);

insert into public.training_types (name, kind, with_distance, sort) values
  ('Studio', 'exercises', false, 10),
  ('Home Gym', 'exercises', false, 20),
  ('Laufen', 'duration', true, 30),
  ('Fußball', 'duration', false, 40);

-- Personal training preferences (the real link to the home studio lives here, not in the
-- core profile, so the training module stays self-contained).
create table public.training_prefs (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  home_location_id uuid references public.locations (id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger training_prefs_set_updated_at
  before update on public.training_prefs
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create function private.can_view_location(p_location_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.locations l
     where l.id = p_location_id
       and (l.owner_id is null or private.can_view_user_data(l.owner_id, 'training'))
  );
$$;

-- Catalogue entries can be edited by whoever created them, and by the super admin.
create function private.can_edit_catalog(p_created_by uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_created_by = (select auth.uid()) or private.is_super_admin();
$$;

create function private.can_edit_exercise(p_exercise_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.exercises e
     where e.id = p_exercise_id and private.can_edit_catalog(e.created_by)
  );
$$;

create function private.can_edit_device(p_device_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.devices d
      join public.locations l on l.id = d.location_id
     where d.id = p_device_id
       and (private.can_edit_catalog(d.created_by) or l.owner_id = (select auth.uid()))
  );
$$;

revoke all on all functions in schema private from public;
grant execute on function private.can_view_location(uuid) to authenticated;
grant execute on function private.can_edit_catalog(uuid) to authenticated;
grant execute on function private.can_edit_exercise(uuid) to authenticated;
grant execute on function private.can_edit_device(uuid) to authenticated;
grant execute on function private.can_view_user_data(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Search: name or alias, case-insensitive; best matches first.
-- ---------------------------------------------------------------------------
create function public.search_exercises(p_query text, p_limit integer default 20)
returns table (id uuid, name text, measure public.exercise_measure, matched_alias text)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (select lower(btrim(coalesce(p_query, ''))) as term)
  select e.id, e.name, e.measure,
         (select a.alias from public.exercise_aliases a
           where a.exercise_id = e.id and lower(a.alias) like '%' || q.term || '%'
           limit 1) as matched_alias
    from public.exercises e, q
   where e.merged_into is null
     and (q.term = ''
       or lower(e.name) like '%' || q.term || '%'
       or exists (select 1 from public.exercise_aliases a
                   where a.exercise_id = e.id and lower(a.alias) like '%' || q.term || '%'))
   order by (lower(e.name) = q.term) desc,
            (lower(e.name) like q.term || '%') desc,
            e.name
   limit least(greatest(p_limit, 1), 50);
$$;

revoke all on function public.search_exercises(text, integer) from public, anon;
grant execute on function public.search_exercises(text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------
revoke all on public.muscle_groups, public.exercises, public.exercise_aliases,
  public.exercise_muscles, public.locations, public.devices, public.device_exercises,
  public.user_device_settings, public.training_types, public.training_prefs
  from anon, authenticated;

grant select on public.muscle_groups to authenticated;
grant select, insert on public.exercises to authenticated;
grant update (name, measure) on public.exercises to authenticated;
grant select, insert, delete on public.exercise_aliases, public.exercise_muscles to authenticated;
grant select, insert on public.locations to authenticated;
grant update (name) on public.locations to authenticated;
grant select, insert on public.devices to authenticated;
grant update (name, weight_step, weight_min, weight_max) on public.devices to authenticated;
grant select, insert, delete on public.device_exercises to authenticated;
grant select, insert, update, delete on public.user_device_settings to authenticated;
grant select, insert on public.training_types to authenticated;
grant update (name, kind, with_distance, sort, archived_at) on public.training_types to authenticated;
grant select, insert, update on public.training_prefs to authenticated;

alter table public.muscle_groups enable row level security;
alter table public.exercises enable row level security;
alter table public.exercise_aliases enable row level security;
alter table public.exercise_muscles enable row level security;
alter table public.locations enable row level security;
alter table public.devices enable row level security;
alter table public.device_exercises enable row level security;
alter table public.user_device_settings enable row level security;
alter table public.training_types enable row level security;
alter table public.training_prefs enable row level security;

create policy "muscle_groups: readable" on public.muscle_groups
  for select to authenticated using (true);

-- Global catalogue: everyone signed in reads it and may add to it.
create policy "exercises: readable" on public.exercises
  for select to authenticated using (true);
create policy "exercises: add as yourself" on public.exercises
  for insert to authenticated with check (created_by = (select auth.uid()));
create policy "exercises: creator or super admin edits" on public.exercises
  for update to authenticated
  using (private.can_edit_catalog(created_by))
  with check (private.can_edit_catalog(created_by));

create policy "exercise_aliases: readable" on public.exercise_aliases
  for select to authenticated using (true);
create policy "exercise_aliases: editors manage" on public.exercise_aliases
  for insert to authenticated with check (private.can_edit_exercise(exercise_id));
create policy "exercise_aliases: editors remove" on public.exercise_aliases
  for delete to authenticated using (private.can_edit_exercise(exercise_id));

create policy "exercise_muscles: readable" on public.exercise_muscles
  for select to authenticated using (true);
create policy "exercise_muscles: editors manage" on public.exercise_muscles
  for insert to authenticated with check (private.can_edit_exercise(exercise_id));
create policy "exercise_muscles: editors remove" on public.exercise_muscles
  for delete to authenticated using (private.can_edit_exercise(exercise_id));

-- Locations: public studios for everyone, private places for their owner (and people who
-- may see the owner's training).
create policy "locations: public or visible private" on public.locations
  for select to authenticated
  using (owner_id is null or private.can_view_user_data(owner_id, 'training'));
create policy "locations: add public or own private" on public.locations
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (owner_id is null or owner_id = (select auth.uid()))
  );
create policy "locations: creator, owner or super admin edits" on public.locations
  for update to authenticated
  using (private.can_edit_catalog(created_by) or owner_id = (select auth.uid()))
  with check (private.can_edit_catalog(created_by) or owner_id = (select auth.uid()));

create policy "devices: at visible locations" on public.devices
  for select to authenticated using (private.can_view_location(location_id));
create policy "devices: add at public or own locations" on public.devices
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.locations l
       where l.id = location_id and (l.owner_id is null or l.owner_id = (select auth.uid()))
    )
  );
create policy "devices: editors update" on public.devices
  for update to authenticated
  using (private.can_edit_device(id))
  with check (private.can_edit_device(id));

create policy "device_exercises: at visible locations" on public.device_exercises
  for select to authenticated
  using (exists (select 1 from public.devices d
                  where d.id = device_id and private.can_view_location(d.location_id)));
create policy "device_exercises: device editors manage" on public.device_exercises
  for insert to authenticated with check (private.can_edit_device(device_id));
create policy "device_exercises: device editors remove" on public.device_exercises
  for delete to authenticated using (private.can_edit_device(device_id));

create policy "user_device_settings: own" on public.user_device_settings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "training_types: defaults, own and visible" on public.training_types
  for select to authenticated
  using (owner_id is null or private.can_view_user_data(owner_id, 'training'));
create policy "training_types: add own" on public.training_types
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "training_types: edit own" on public.training_types
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "training_prefs: own" on public.training_prefs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Backfill: existing free-text home gyms become public studios.
-- ---------------------------------------------------------------------------
insert into public.locations (name, created_by)
select distinct on (lower(btrim(p.home_gym))) btrim(p.home_gym), p.id
  from public.profiles p
 where p.home_gym is not null and char_length(btrim(p.home_gym)) >= 2
 order by lower(btrim(p.home_gym)), p.created_at
on conflict do nothing;

insert into public.training_prefs (user_id, home_location_id)
select p.id, l.id
  from public.profiles p
  join public.locations l
    on l.owner_id is null and lower(btrim(l.name)) = lower(btrim(p.home_gym));
