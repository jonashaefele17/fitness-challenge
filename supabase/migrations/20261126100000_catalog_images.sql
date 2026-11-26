-- Catalogue images: rendered illustrations for device types and exercises.
-- The files live in the public Storage bucket "catalog" (uploaded with
-- scripts/upload-catalog-images.mjs); image_path holds the path inside that bucket.
-- Also adds what the FitX catalogue was missing: the cable row station and the lateral raise
-- machine as device types, plus three exercises.

-- ---------------------------------------------------------------------------
-- 1. Bucket: public read, writes only with the service role (no policies for users yet;
--    uploads from the app come with the image upload on the exercise page).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalog', 'catalog', true, 1048576, array['image/webp', 'image/png'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Catalogue additions (same tolerant pattern as the starter catalogue: match by name,
--    never overwrite muscles people already chose)
-- ---------------------------------------------------------------------------
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
      ('Ruderzug', false, 2.5, 'Enges Rudern sitzend', 'weight_reps',
        array['upper_back', 'lats'], array['biceps', 'rear_delts']),
      ('Rudermaschine', false, 2.5, 'Rudern an der Maschine', 'weight_reps',
        array['upper_back', 'lats'], array['biceps', 'rear_delts']),
      ('Seithebe-Maschine', false, 2.5, 'Seitheben an der Maschine', 'weight_reps',
        array['side_delts'], array[]::text[]),
      ('Kabelturm', false, 1.25, 'Trizepsstrecken über Kopf am Kabel', 'weight_reps',
        array['triceps'], array[]::text[])
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

  -- The two new types exist at FitX Neuperlach Süd.
  select id into v_location from public.locations
   where owner_id is null and lower(name) = lower('FitX Neuperlach Süd');
  if v_location is not null then
    insert into public.devices (location_id, device_type_id)
    select v_location, t.id from public.device_types t
     where lower(btrim(t.name)) in ('ruderzug', 'seithebe-maschine')
    on conflict do nothing;
  end if;
end
$seed$;

insert into public.exercise_aliases (exercise_id, alias)
select e.id, a.alias
  from (values
    ('Trizepsstrecken über Kopf am Kabel', 'Overhead Triceps Extension'),
    ('Seitheben an der Maschine', 'Lateral Raise'),
    ('Rudern an der Maschine', 'Low Row')
  ) as a (exercise, alias)
  join public.exercises e on lower(btrim(e.name)) = lower(a.exercise) and e.merged_into is null
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 3. Image paths (only where none is set, so later uploads are never overwritten)
-- ---------------------------------------------------------------------------
update public.device_types t
   set image_path = 'device-types/' || i.file || '.webp'
  from (values
    ('Kurzhanteln', 'kurzhanteln'),
    ('Kabelturm', 'kabelturm'),
    ('Brustpresse', 'brustpresse'),
    ('Butterfly', 'butterfly'),
    ('Latzug', 'latzug'),
    ('Ruderzug', 'ruderzug'),
    ('Rudermaschine', 'rudermaschine'),
    ('Seithebe-Maschine', 'seithebe-maschine'),
    ('Beinpresse', 'beinpresse'),
    ('Beinstrecker', 'beinstrecker'),
    ('Beinbeuger', 'beinbeuger'),
    ('Adduktoren-Maschine', 'adduktoren-maschine'),
    ('Abduktoren-Maschine', 'abduktoren-maschine')
  ) as i (name, file)
 where lower(btrim(t.name)) = lower(i.name) and t.image_path is null;

update public.exercises e
   set image_path = 'exercises/' || i.file || '.webp'
  from (values
    ('Schrägbankdrücken mit Kurzhanteln', 'schraegbankdruecken-mit-kurzhanteln'),
    ('Bizepscurls mit Kurzhanteln', 'bizepscurls-mit-kurzhanteln'),
    ('Trizepsdrücken am Kabel', 'trizepsdruecken-am-kabel'),
    ('Trizepsstrecken über Kopf am Kabel', 'trizepsstrecken-ueber-kopf-am-kabel'),
    ('Bizepscurls am Kabel', 'bizepscurls-am-kabel'),
    ('Seitheben am Kabel', 'seitheben-am-kabel'),
    ('Brustpresse', 'brustpresse'),
    ('Butterfly', 'butterfly'),
    ('Reverse Butterfly', 'reverse-butterfly'),
    ('Latzug', 'latzug'),
    ('Latzug eng', 'latzug-eng'),
    ('Enges Rudern sitzend', 'enges-rudern-sitzend'),
    ('Rudern an der Maschine', 'rudern-an-der-maschine'),
    ('Seitheben an der Maschine', 'seitheben-an-der-maschine'),
    ('Beinpresse', 'beinpresse'),
    ('Beinstrecken', 'beinstrecken'),
    ('Beinbeugen', 'beinbeugen'),
    ('Adduktoren', 'adduktoren'),
    ('Abduktoren', 'abduktoren')
  ) as i (name, file)
 where lower(btrim(e.name)) = lower(i.name) and e.merged_into is null and e.image_path is null;
