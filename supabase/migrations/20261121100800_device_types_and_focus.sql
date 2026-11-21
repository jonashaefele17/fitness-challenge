-- Training module, part 4: device types (classes) and training focus.
--
-- Device types are global "classes" (Kabelturm, Beinbeuger, Kurzhanteln …). They carry the
-- exercises, the setting fields, the default weight step, comparability and the image.
-- A device is an instance of a type at one place (FitX Neuperlach Süd's Kabelturm); it keeps
-- its own history and may override the weight step. Exercises a place does not offer can be
-- hidden per device.
--
-- Training focus (Push, Pull, Beine …) is a set of muscle groups; exercises match by their
-- primary muscles. Exercises never change when a focus is edited.
--
-- Existing devices are converted into instances of matching types (no data is lost).

-- ---------------------------------------------------------------------------
-- 1. Shoulders split into front / side / rear delts (needed for Push vs. Pull)
-- ---------------------------------------------------------------------------
insert into public.muscle_groups (key, label, sort) values
  ('front_delts', 'Vordere Schulter', 40),
  ('side_delts', 'Seitliche Schulter', 41),
  ('rear_delts', 'Hintere Schulter', 42);

-- Existing assignments: lateral raises → side delts, everything else → front delts.
insert into public.exercise_muscles (exercise_id, muscle_group, role)
select em.exercise_id,
       case when e.name ilike '%seitheben%' then 'side_delts' else 'front_delts' end,
       em.role
  from public.exercise_muscles em
  join public.exercises e on e.id = em.exercise_id
 where em.muscle_group = 'shoulders'
on conflict do nothing;
delete from public.exercise_muscles where muscle_group = 'shoulders';
delete from public.muscle_groups where key = 'shoulders';

-- ---------------------------------------------------------------------------
-- 2. Device types
-- ---------------------------------------------------------------------------
create table public.device_types (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  image_path text,
  setting_fields text[] not null default '{}' check (cardinality(setting_fields) <= 6),
  default_weight_step numeric(6, 2) check (default_weight_step is null or default_weight_step > 0),
  -- Comparable everywhere (dumbbells, bar …): one shared history across places.
  comparable boolean not null default false,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index device_types_name_unique_idx on public.device_types (lower(btrim(name)));

create table public.device_type_exercises (
  device_type_id uuid not null references public.device_types (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  added_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (device_type_id, exercise_id)
);
create index device_type_exercises_exercise_idx on public.device_type_exercises (exercise_id);

-- ---------------------------------------------------------------------------
-- 3. Starter catalogue of device types with their default exercises
-- ---------------------------------------------------------------------------
do $seed$
declare
  r record;
  v_type uuid;
  v_exercise uuid;
  v_muscle text;
begin
  -- type, comparable, default step, exercise, measure, primary muscles, secondary muscles
  for r in
    select * from (values
      ('Brustpresse', false, 2.5, 'Brustpresse', 'weight_reps', array['chest'], array['front_delts', 'triceps']),
      ('Schulterpresse', false, 2.5, 'Schulterdrücken an der Maschine', 'weight_reps', array['front_delts'], array['side_delts', 'triceps']),
      ('Butterfly', false, 2.5, 'Butterfly', 'weight_reps', array['chest'], array['front_delts']),
      ('Butterfly', false, 2.5, 'Reverse Butterfly', 'weight_reps', array['rear_delts'], array['upper_back']),
      ('Latzug', false, 2.5, 'Latzug', 'weight_reps', array['lats'], array['biceps', 'upper_back']),
      ('Latzug', false, 2.5, 'Latzug eng', 'weight_reps', array['lats'], array['biceps']),
      ('Rudermaschine', false, 2.5, 'Enges Rudern sitzend', 'weight_reps', array['upper_back', 'lats'], array['biceps', 'rear_delts']),
      ('Rudermaschine', false, 2.5, 'Rudern breit', 'weight_reps', array['upper_back', 'rear_delts'], array['biceps']),
      ('Kabelturm', false, 1.25, 'Trizepsdrücken am Kabel', 'weight_reps', array['triceps'], array[]::text[]),
      ('Kabelturm', false, 1.25, 'Bizepscurls am Kabel', 'weight_reps', array['biceps'], array['forearms']),
      ('Kabelturm', false, 1.25, 'Seitheben am Kabel', 'weight_reps', array['side_delts'], array[]::text[]),
      ('Kabelturm', false, 1.25, 'Face Pulls', 'weight_reps', array['rear_delts', 'upper_back'], array[]::text[]),
      ('Beinpresse', false, 2.5, 'Beinpresse', 'weight_reps', array['quads', 'glutes'], array['hamstrings']),
      ('Beinpresse', false, 2.5, 'Wadenheben an der Beinpresse', 'weight_reps', array['calves'], array[]::text[]),
      ('Beinstrecker', false, 2.5, 'Beinstrecken', 'weight_reps', array['quads'], array[]::text[]),
      ('Beinbeuger', false, 2.5, 'Beinbeugen', 'weight_reps', array['hamstrings'], array['calves']),
      ('Adduktoren-Maschine', false, 2.5, 'Adduktoren', 'weight_reps', array['adductors'], array[]::text[]),
      ('Abduktoren-Maschine', false, 2.5, 'Abduktoren', 'weight_reps', array['glutes'], array[]::text[]),
      ('Wadenmaschine', false, 2.5, 'Wadenheben', 'weight_reps', array['calves'], array[]::text[]),
      ('Bauchmaschine', false, 2.5, 'Crunch an der Maschine', 'weight_reps', array['abs'], array[]::text[]),
      ('Rückenstrecker', false, 2.5, 'Rückenstrecken', 'weight_reps', array['lower_back'], array['glutes', 'hamstrings']),
      ('Hackenschmidt', false, 2.5, 'Hackenschmidt-Kniebeuge', 'weight_reps', array['quads'], array['glutes']),
      ('Multipresse', false, 2.5, 'Kniebeuge an der Multipresse', 'weight_reps', array['quads', 'glutes'], array['hamstrings']),
      ('Multipresse', false, 2.5, 'Bankdrücken an der Multipresse', 'weight_reps', array['chest'], array['front_delts', 'triceps']),
      ('Kurzhanteln', true, 2.5, 'Schrägbankdrücken mit Kurzhanteln', 'weight_reps', array['chest'], array['front_delts', 'triceps']),
      ('Kurzhanteln', true, 2.5, 'Kurzhantel-Rudern', 'weight_reps', array['lats', 'upper_back'], array['biceps', 'rear_delts']),
      ('Kurzhanteln', true, 2.5, 'Bizepscurls mit Kurzhanteln', 'weight_reps', array['biceps'], array['forearms']),
      ('Kurzhanteln', true, 2.5, 'Seitheben mit Kurzhanteln', 'weight_reps', array['side_delts'], array[]::text[]),
      ('Langhantel', true, 2.5, 'Bankdrücken', 'weight_reps', array['chest'], array['front_delts', 'triceps']),
      ('Langhantel', true, 2.5, 'Kniebeuge', 'weight_reps', array['quads', 'glutes'], array['hamstrings', 'lower_back']),
      ('Langhantel', true, 2.5, 'Kreuzheben', 'weight_reps', array['hamstrings', 'glutes', 'lower_back'], array['upper_back', 'forearms']),
      ('Langhantel', true, 2.5, 'Rudern vorgebeugt', 'weight_reps', array['upper_back', 'lats'], array['biceps', 'rear_delts']),
      ('Klimmzugstange', true, 2.5, 'Klimmzüge', 'reps', array['lats'], array['biceps', 'upper_back']),
      ('Klimmzugstange', true, 2.5, 'Hängendes Beinheben', 'reps', array['abs'], array['forearms']),
      ('Dip-Station', true, 2.5, 'Dips', 'reps', array['triceps', 'chest'], array['front_delts']),
      ('Ringe', true, 2.5, 'Ring-Dips', 'reps', array['triceps', 'chest'], array['front_delts']),
      ('Ringe', true, 2.5, 'Ring-Rudern', 'reps', array['upper_back', 'lats'], array['biceps', 'rear_delts']),
      ('Kettlebell', true, 4, 'Kettlebell Swings', 'weight_reps', array['glutes', 'hamstrings'], array['lower_back']),
      ('Kettlebell', true, 4, 'Goblet Squat', 'weight_reps', array['quads', 'glutes'], array[]::text[]),
      ('Boden / Matte', true, null, 'Liegestütze', 'reps', array['chest'], array['triceps', 'front_delts']),
      ('Boden / Matte', true, null, 'Plank', 'duration', array['abs'], array[]::text[]),
      ('Boden / Matte', true, null, 'L-Sit', 'duration', array['abs'], array['triceps'])
    ) as t (type_name, comparable, step, exercise, measure, primary_muscles, secondary_muscles)
  loop
    select id into v_type from public.device_types where lower(name) = lower(r.type_name);
    if v_type is null then
      insert into public.device_types (name, comparable, default_weight_step)
      values (r.type_name, r.comparable, r.step)
      returning id into v_type;
    end if;

    select id into v_exercise from public.exercises
     where lower(btrim(name)) = lower(r.exercise) and merged_into is null;
    if v_exercise is null then
      insert into public.exercises (name, measure)
      values (r.exercise, r.measure::public.exercise_measure)
      returning id into v_exercise;
    end if;

    insert into public.device_type_exercises (device_type_id, exercise_id)
    values (v_type, v_exercise) on conflict do nothing;

    -- Muscles only for exercises that have none yet (never overwrite people's choices).
    if not exists (select 1 from public.exercise_muscles where exercise_id = v_exercise) then
      foreach v_muscle in array r.primary_muscles loop
        insert into public.exercise_muscles (exercise_id, muscle_group, role)
        values (v_exercise, v_muscle, 'primary') on conflict do nothing;
      end loop;
      foreach v_muscle in array r.secondary_muscles loop
        insert into public.exercise_muscles (exercise_id, muscle_group, role)
        values (v_exercise, v_muscle, 'secondary') on conflict do nothing;
      end loop;
    end if;
  end loop;
end
$seed$;

insert into public.exercise_aliases (exercise_id, alias)
select e.id, a.alias
  from (values
    ('Face Pulls', 'Face Pull'),
    ('Reverse Butterfly', 'Reverse Fly'),
    ('Schulterdrücken an der Maschine', 'Shoulder Press'),
    ('Kreuzheben', 'Deadlift'),
    ('Kniebeuge', 'Squat'),
    ('Bankdrücken', 'Bench Press'),
    ('Klimmzüge', 'Pull-ups'),
    ('Liegestütze', 'Push-ups')
  ) as a (exercise, alias)
  join public.exercises e on lower(e.name) = lower(a.exercise) and e.merged_into is null
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 4. Devices become instances of a type
-- ---------------------------------------------------------------------------
alter table public.devices add column device_type_id uuid references public.device_types (id);

-- Match existing devices by name (with a few known renames), create types for the rest.
do $convert$
declare
  d record;
  v_type uuid;
  v_name text;
begin
  for d in select * from public.devices loop
    v_name := case lower(d.name)
                when 'ruder-maschine' then 'Rudermaschine'
                else d.name
              end;
    select id into v_type from public.device_types where lower(name) = lower(v_name);
    if v_type is null then
      insert into public.device_types (name, comparable, default_weight_step, setting_fields, created_by)
      values (v_name, d.comparable, d.weight_step, d.setting_fields, d.created_by)
      returning id into v_type;
    else
      -- Keep fields people already defined on the device.
      update public.device_types
         set setting_fields = d.setting_fields
       where id = v_type and cardinality(setting_fields) = 0 and cardinality(d.setting_fields) > 0;
    end if;
    update public.devices set device_type_id = v_type where id = d.id;
    insert into public.device_type_exercises (device_type_id, exercise_id)
    select v_type, de.exercise_id from public.device_exercises de where de.device_id = d.id
    on conflict do nothing;
  end loop;
end
$convert$;

-- Weight step on the device is now an optional override of the type default.
update public.devices d
   set weight_step = null
  from public.device_types t
 where t.id = d.device_type_id and d.weight_step = t.default_weight_step;

-- One instance per type and place: merge duplicates (e.g. two "Kabelturm" created while
-- testing) into the oldest one, keeping history and settings.
do $merge$
declare
  dup record;
begin
  for dup in
    select d.id, first_value(d.id) over w as keep_id
      from public.devices d
    window w as (partition by d.location_id, d.device_type_id order by d.created_at, d.id)
  loop
    continue when dup.id = dup.keep_id;
    update public.workout_items set device_id = dup.keep_id where device_id = dup.id;
    delete from public.user_device_settings s
     where s.device_id = dup.id
       and exists (select 1 from public.user_device_settings k
                    where k.device_id = dup.keep_id and k.user_id = s.user_id
                      and k.exercise_id = s.exercise_id);
    update public.user_device_settings set device_id = dup.keep_id where device_id = dup.id;
    delete from public.devices where id = dup.id;
  end loop;
end
$merge$;

alter table public.devices alter column device_type_id set not null;
create index devices_type_idx on public.devices (device_type_id);
create unique index devices_location_type_unique_idx on public.devices (location_id, device_type_id);

drop table public.device_exercises;
alter table public.devices drop column name;
alter table public.devices drop column comparable;
alter table public.devices drop column setting_fields;
alter table public.devices drop column weight_min;
alter table public.devices drop column weight_max;

-- Exercises a place does not offer (e.g. no rope handle for face pulls).
create table public.device_hidden_exercises (
  device_id uuid not null references public.devices (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  hidden_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (device_id, exercise_id)
);

-- ---------------------------------------------------------------------------
-- 5. Training focus
-- ---------------------------------------------------------------------------
create table public.training_focuses (
  id uuid primary key default gen_random_uuid(),
  -- null: default for everyone · set: personal focus
  owner_id uuid references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 40),
  muscle_groups text[] not null check (cardinality(muscle_groups) between 1 and 20),
  sort integer not null default 100,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

insert into public.training_focuses (name, muscle_groups, sort) values
  ('Push', array['chest', 'front_delts', 'side_delts', 'triceps'], 10),
  ('Pull', array['lats', 'upper_back', 'rear_delts', 'biceps', 'forearms'], 20),
  ('Beine', array['quads', 'hamstrings', 'glutes', 'calves', 'adductors'], 30),
  ('Oberkörper', array['chest', 'front_delts', 'side_delts', 'rear_delts', 'triceps', 'lats',
                       'upper_back', 'biceps', 'forearms', 'abs'], 40),
  ('Unterkörper', array['quads', 'hamstrings', 'glutes', 'calves', 'adductors', 'lower_back'], 50),
  ('Arme', array['biceps', 'triceps', 'forearms'], 60),
  ('Ganzkörper', array['chest', 'front_delts', 'side_delts', 'rear_delts', 'triceps', 'lats',
                       'upper_back', 'biceps', 'forearms', 'abs', 'lower_back', 'quads',
                       'hamstrings', 'glutes', 'calves', 'adductors'], 70);

alter table public.workouts
  add column focus_id uuid references public.training_focuses (id) on delete set null;
grant update (focus_id) on public.workouts to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Functions that looked at device columns
-- ---------------------------------------------------------------------------
create or replace function private.device_comparable(p_device_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select t.comparable
    from public.devices d
    join public.device_types t on t.id = d.device_type_id
   where d.id = p_device_id;
$$;

create or replace function private.history_scope_matches(p_device_id uuid, p_item_device_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_device_id is not null and not coalesce(private.device_comparable(p_device_id), true)
      then p_item_device_id = p_device_id
    else p_item_device_id is null
      or coalesce(private.device_comparable(p_item_device_id), true)
  end;
$$;

create or replace function public.exercise_overview()
returns table (
  exercise_id uuid,
  scope_device_id uuid,
  last_done_at timestamptz,
  last_weight_kg numeric,
  last_reps integer,
  last_duration_seconds integer,
  trend numeric[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  with per_set as (
    select i.exercise_id,
           case when d.id is not null and not t.comparable then d.id end as scope_device_id,
           w.id as workout_id,
           w.started_at,
           s.weight_kg,
           s.reps,
           s.duration_seconds,
           case e.measure
             when 'weight_reps' then s.weight_kg
             when 'reps' then s.reps::numeric
             else s.duration_seconds::numeric
           end as value
      from public.workout_items i
      join public.workouts w on w.id = i.workout_id
      join public.exercises e on e.id = i.exercise_id
      join public.workout_sets s on s.item_id = i.id
      left join public.devices d on d.id = i.device_id
      left join public.device_types t on t.id = d.device_type_id
     where w.user_id = (select auth.uid())
       and w.status = 'finished'
       and s.completed_at is not null
       and not s.is_warmup
  ),
  best_per_workout as (
    select distinct on (exercise_id, scope_device_id, workout_id)
           exercise_id, scope_device_id, workout_id, started_at, value,
           weight_kg, reps, duration_seconds
      from per_set
     order by exercise_id, scope_device_id, workout_id, value desc nulls last, reps desc nulls last
  ),
  ranked as (
    select *,
           row_number() over (
             partition by exercise_id, scope_device_id order by started_at desc
           ) as rn
      from best_per_workout
  )
  select exercise_id,
         scope_device_id,
         max(started_at) filter (where rn = 1),
         max(weight_kg) filter (where rn = 1),
         max(reps) filter (where rn = 1),
         max(duration_seconds) filter (where rn = 1),
         array_agg(value order by started_at) filter (where rn <= 6)
    from ranked
   group by exercise_id, scope_device_id;
$$;

-- How often each exercise appears in the workouts I may see (mine and shared ones), to put
-- popular exercises of a device type first. RLS on workout_items does the scoping.
create function public.exercise_popularity()
returns table (exercise_id uuid, uses bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select i.exercise_id, count(distinct i.workout_id)
    from public.workout_items i
   group by i.exercise_id;
$$;
grant execute on function public.exercise_popularity() to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Privileges and RLS
-- ---------------------------------------------------------------------------
revoke all on public.devices from authenticated;
grant select, insert on public.devices to authenticated;
grant update (weight_step, image_path) on public.devices to authenticated;

revoke all on public.device_types, public.device_type_exercises, public.device_hidden_exercises,
  public.training_focuses from anon, authenticated;
grant select, insert on public.device_types to authenticated;
grant update (name, image_path, setting_fields, default_weight_step, comparable)
  on public.device_types to authenticated;
grant select, insert on public.device_type_exercises to authenticated;
grant delete on public.device_type_exercises to authenticated;
grant select, insert, delete on public.device_hidden_exercises to authenticated;
grant select, insert on public.training_focuses to authenticated;
grant update (name, muscle_groups, sort, archived_at) on public.training_focuses to authenticated;

alter table public.device_types enable row level security;
alter table public.device_type_exercises enable row level security;
alter table public.device_hidden_exercises enable row level security;
alter table public.training_focuses enable row level security;

-- Device types and their exercises are a shared catalogue for the (small, trusted) group:
-- everyone reads and extends them; removing an exercise from a type is for the super admin
-- (places hide exercises instead).
create policy "device_types: readable" on public.device_types
  for select to authenticated using (true);
create policy "device_types: add as yourself" on public.device_types
  for insert to authenticated with check (created_by = (select auth.uid()));
create policy "device_types: members edit" on public.device_types
  for update to authenticated using (true) with check (true);

create policy "device_type_exercises: readable" on public.device_type_exercises
  for select to authenticated using (true);
create policy "device_type_exercises: members add" on public.device_type_exercises
  for insert to authenticated with check (added_by = (select auth.uid()));
create policy "device_type_exercises: super admin removes" on public.device_type_exercises
  for delete to authenticated using (private.is_super_admin());

create policy "device_hidden_exercises: at visible devices" on public.device_hidden_exercises
  for select to authenticated
  using (exists (select 1 from public.devices d
                  where d.id = device_id and private.can_view_location(d.location_id)));
create policy "device_hidden_exercises: device editors hide" on public.device_hidden_exercises
  for insert to authenticated with check (private.can_edit_device(device_id));
create policy "device_hidden_exercises: device editors unhide" on public.device_hidden_exercises
  for delete to authenticated using (private.can_edit_device(device_id));

create policy "training_focuses: defaults, own and visible" on public.training_focuses
  for select to authenticated
  using (owner_id is null or private.can_view_user_data(owner_id, 'training'));
create policy "training_focuses: add own" on public.training_focuses
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "training_focuses: edit own" on public.training_focuses
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

revoke all on all functions in schema private from public;
grant execute on function private.device_comparable(uuid) to authenticated;
grant execute on function private.history_scope_matches(uuid, uuid) to authenticated;
grant execute on function private.can_view_location(uuid) to authenticated;
grant execute on function private.can_edit_device(uuid) to authenticated;
