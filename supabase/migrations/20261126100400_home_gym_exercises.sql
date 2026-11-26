-- Catalogue: home gym exercises for all major muscle groups (dumbbells, bench, pull-up bar,
-- rings, bodyweight) and their images. Five dumbbell exercises are new, Goblet Squat is also
-- offered with dumbbells.
-- Tolerant like the other catalogue migrations: match by name, never overwrite.

do $seed$
declare
  r record;
  v_type uuid;
  v_exercise uuid;
  v_muscle text;
begin
  -- type, exercise, measure, primary muscles, secondary muscles
  for r in
    select * from (values
      ('Kurzhanteln', 'Schulterdrücken mit Kurzhanteln', 'weight_reps',
        array['front_delts', 'side_delts'], array['triceps']),
      ('Kurzhanteln', 'Trizepsstrecken über Kopf mit Kurzhantel', 'weight_reps',
        array['triceps'], array[]::text[]),
      ('Kurzhanteln', 'Bulgarian Split Squat', 'weight_reps',
        array['quads', 'glutes'], array['hamstrings', 'adductors']),
      ('Kurzhanteln', 'Rumänisches Kreuzheben mit Kurzhanteln', 'weight_reps',
        array['hamstrings', 'glutes'], array['lower_back']),
      ('Kurzhanteln', 'Wadenheben mit Kurzhanteln', 'weight_reps',
        array['calves'], array[]::text[]),
      ('Kurzhanteln', 'Goblet Squat', 'weight_reps',
        array['quads', 'glutes'], array['adductors', 'lower_back'])
    ) as t (type_name, exercise, measure, primary_muscles, secondary_muscles)
  loop
    select id into v_type from public.device_types where lower(btrim(name)) = lower(r.type_name);
    continue when v_type is null;

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
end
$seed$;

insert into public.exercise_aliases (exercise_id, alias)
select e.id, a.alias
  from (values
    ('Schulterdrücken mit Kurzhanteln', 'Shoulder Press'),
    ('Schulterdrücken mit Kurzhanteln', 'Overhead Press'),
    ('Trizepsstrecken über Kopf mit Kurzhantel', 'Overhead Triceps Extension'),
    ('Bulgarian Split Squat', 'Bulgarische Kniebeuge'),
    ('Rumänisches Kreuzheben mit Kurzhanteln', 'RDL'),
    ('Rumänisches Kreuzheben mit Kurzhanteln', 'Romanian Deadlift'),
    ('Wadenheben mit Kurzhanteln', 'Calf Raises')
  ) as a (exercise, alias)
  join public.exercises e on lower(btrim(e.name)) = lower(a.exercise) and e.merged_into is null
on conflict do nothing;

update public.exercises e
   set image_path = 'exercises/' || i.file || '.webp'
  from (values
    ('Liegestütze', 'liegestuetze'),
    ('Ring-Dips', 'ring-dips'),
    ('Klimmzüge', 'klimmzuege'),
    ('Ring-Rudern', 'ring-rudern'),
    ('Kurzhantel-Rudern', 'kurzhantel-rudern'),
    ('Schulterdrücken mit Kurzhanteln', 'schulterdruecken-mit-kurzhanteln'),
    ('Seitheben mit Kurzhanteln', 'seitheben-mit-kurzhanteln'),
    ('Trizepsstrecken über Kopf mit Kurzhantel', 'trizepsstrecken-ueber-kopf-mit-kurzhantel'),
    ('Goblet Squat', 'goblet-squat'),
    ('Bulgarian Split Squat', 'bulgarian-split-squat'),
    ('Rumänisches Kreuzheben mit Kurzhanteln', 'rumaenisches-kreuzheben-mit-kurzhanteln'),
    ('Wadenheben mit Kurzhanteln', 'wadenheben-mit-kurzhanteln'),
    ('Hängendes Beinheben', 'haengendes-beinheben'),
    ('Plank', 'plank')
  ) as i (name, file)
 where lower(btrim(e.name)) = lower(i.name) and e.merged_into is null and e.image_path is null;
