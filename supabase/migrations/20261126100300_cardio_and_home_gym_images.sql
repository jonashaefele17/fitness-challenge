-- Catalogue: treadmill and exercise bike as device types (cardio as an exercise by duration,
-- e.g. warming up in a strength workout), the bench as a device type of its own, and images for
-- the home gym devices that already exist (pull-up bar, rings, floor / mat).
-- Tolerant like the other catalogue migrations: match by name, never overwrite.

do $seed$
declare
  r record;
  v_type uuid;
  v_exercise uuid;
  v_muscle text;
  v_location uuid;
begin
  -- type, comparable, default step, exercise, measure, primary muscles, secondary muscles
  for r in
    select * from (values
      ('Laufband', true, null::numeric, 'Laufen auf dem Laufband', 'duration',
        array['quads', 'hamstrings', 'calves'], array['glutes']),
      ('Fahrrad-Ergometer', true, null::numeric, 'Radfahren auf dem Ergometer', 'duration',
        array['quads'], array['glutes', 'hamstrings', 'calves']),
      ('Hantelbank', true, 2.5, 'Schrägbankdrücken mit Kurzhanteln', 'weight_reps',
        array['chest'], array['front_delts', 'triceps'])
    ) as t (type_name, comparable, step, exercise, measure, primary_muscles, secondary_muscles)
  loop
    select id into v_type from public.device_types where lower(btrim(name)) = lower(r.type_name);
    if v_type is null then
      insert into public.device_types (name, comparable, default_weight_step, created_by)
      values (r.type_name, r.comparable, r.step, null)
      returning id into v_type;
    end if;

    select id into v_exercise from public.exercises
     where lower(btrim(name)) = lower(r.exercise) and merged_into is null;
    if v_exercise is null then
      insert into public.exercises (name, measure)
      values (r.exercise, r.measure::public.exercise_measure)
      returning id into v_exercise;
    end if;

    insert into public.device_type_exercises (device_type_id, exercise_id, added_by)
    values (v_type, v_exercise, null) on conflict do nothing;

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

  -- Treadmill and bike exist at FitX Neuperlach Süd.
  select id into v_location from public.locations
   where owner_id is null and lower(name) = lower('FitX Neuperlach Süd');
  if v_location is not null then
    insert into public.devices (location_id, device_type_id)
    select v_location, t.id from public.device_types t
     where lower(btrim(t.name)) in ('laufband', 'fahrrad-ergometer')
    on conflict do nothing;
  end if;
end
$seed$;

insert into public.exercise_aliases (exercise_id, alias)
select e.id, a.alias
  from (values
    ('Laufen auf dem Laufband', 'Treadmill'),
    ('Laufen auf dem Laufband', 'Joggen'),
    ('Radfahren auf dem Ergometer', 'Bike'),
    ('Radfahren auf dem Ergometer', 'Fahrrad')
  ) as a (exercise, alias)
  join public.exercises e on lower(btrim(e.name)) = lower(a.exercise) and e.merged_into is null
on conflict do nothing;

update public.device_types t
   set image_path = 'device-types/' || i.file || '.webp'
  from (values
    ('Laufband', 'laufband'),
    ('Fahrrad-Ergometer', 'fahrrad-ergometer'),
    ('Hantelbank', 'hantelbank'),
    ('Klimmzugstange', 'klimmzugstange'),
    ('Ringe', 'ringe'),
    ('Boden / Matte', 'boden-matte')
  ) as i (name, file)
 where lower(btrim(t.name)) = lower(i.name) and t.image_path is null;

update public.exercises e
   set image_path = 'exercises/' || i.file || '.webp'
  from (values
    ('Laufen auf dem Laufband', 'laufen-auf-dem-laufband'),
    ('Radfahren auf dem Ergometer', 'radfahren-auf-dem-ergometer')
  ) as i (name, file)
 where lower(btrim(e.name)) = lower(i.name) and e.merged_into is null and e.image_path is null;
