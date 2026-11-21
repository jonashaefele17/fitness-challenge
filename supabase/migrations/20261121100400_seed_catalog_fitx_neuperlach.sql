-- Starter catalogue (data): FitX Neuperlach Süd with the machines and exercises actually used.
-- Idempotent and tolerant of entries that already exist (matched by name), so it also works
-- on projects where people created some of these exercises while testing.
-- Created without an author: only the super admin can edit these entries afterwards.

do $seed$
declare
  v_location uuid;
  v_device uuid;
  r record;
begin
  insert into public.locations (name) values ('FitX Neuperlach Süd') on conflict do nothing;
  select id into v_location from public.locations
   where owner_id is null and lower(name) = lower('FitX Neuperlach Süd');

  -- device, step, comparable, exercise, measure, primary muscles, secondary muscles
  for r in
    select * from (values
      ('Kurzhanteln', 2.5, true, 'Schrägbankdrücken mit Kurzhanteln', 'weight_reps',
        array['chest'], array['shoulders', 'triceps']),
      ('Latzug', 2.5, false, 'Latzug', 'weight_reps',
        array['lats'], array['biceps', 'upper_back']),
      ('Ruder-Maschine', 2.5, false, 'Enges Rudern sitzend', 'weight_reps',
        array['upper_back', 'lats'], array['biceps']),
      ('Brustpresse', 2.5, false, 'Brustpresse', 'weight_reps',
        array['chest'], array['triceps', 'shoulders']),
      ('Kabelturm', 1.25, false, 'Trizepsdrücken am Kabel', 'weight_reps',
        array['triceps'], array[]::text[]),
      ('Kabelturm', 1.25, false, 'Bizepscurls am Kabel', 'weight_reps',
        array['biceps'], array['forearms']),
      ('Kabelturm', 1.25, false, 'Seitheben am Kabel', 'weight_reps',
        array['shoulders'], array[]::text[]),
      ('Butterfly', 2.5, false, 'Butterfly', 'weight_reps',
        array['chest'], array['shoulders']),
      ('Beinbeuger', 2.5, false, 'Beinbeugen', 'weight_reps',
        array['hamstrings'], array['calves']),
      ('Beinstrecker', 2.5, false, 'Beinstrecken', 'weight_reps',
        array['quads'], array[]::text[]),
      ('Adduktoren-Maschine', 2.5, false, 'Adduktoren', 'weight_reps',
        array['adductors'], array[]::text[]),
      ('Abduktoren-Maschine', 2.5, false, 'Abduktoren', 'weight_reps',
        array['glutes'], array[]::text[]),
      ('Beinpresse', 2.5, false, 'Beinpresse', 'weight_reps',
        array['quads', 'glutes'], array['hamstrings'])
    ) as t (device, step, comparable, exercise, measure, primary_muscles, secondary_muscles)
  loop
    -- Device at the studio (one per name).
    select id into v_device from public.devices
     where location_id = v_location and lower(name) = lower(r.device);
    if v_device is null then
      insert into public.devices (location_id, name, weight_step, weight_min, comparable)
      values (v_location, r.device, r.step, 0, r.comparable)
      returning id into v_device;
    end if;

    -- Exercise (reuse an existing one with the same name).
    insert into public.exercises (name, measure)
    values (r.exercise, r.measure::public.exercise_measure)
    on conflict do nothing;

    insert into public.device_exercises (device_id, exercise_id)
    select v_device, e.id from public.exercises e
     where lower(btrim(e.name)) = lower(r.exercise) and e.merged_into is null
    on conflict do nothing;

    insert into public.exercise_muscles (exercise_id, muscle_group, role)
    select e.id, m, 'primary' from public.exercises e, unnest(r.primary_muscles) as m
     where lower(btrim(e.name)) = lower(r.exercise) and e.merged_into is null
    union all
    select e.id, m, 'secondary' from public.exercises e, unnest(r.secondary_muscles) as m
     where lower(btrim(e.name)) = lower(r.exercise) and e.merged_into is null
    on conflict do nothing;
  end loop;
end
$seed$;

-- Aliases for common alternative names.
insert into public.exercise_aliases (exercise_id, alias)
select e.id, a.alias
  from (values
    ('Latzug', 'Lat Pulldown'),
    ('Beinbeugen', 'Kniebeuger'),
    ('Beinbeugen', 'Leg Curl'),
    ('Beinstrecken', 'Kniestrecker'),
    ('Beinstrecken', 'Leg Extension'),
    ('Brustpresse', 'Chest Press'),
    ('Butterfly', 'Pec Deck'),
    ('Beinpresse', 'Leg Press'),
    ('Enges Rudern sitzend', 'Seated Row'),
    ('Trizepsdrücken am Kabel', 'Pushdown')
  ) as a (exercise, alias)
  join public.exercises e on lower(e.name) = lower(a.exercise) and e.merged_into is null
on conflict do nothing;
