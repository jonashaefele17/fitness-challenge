-- Default places per training type and device-aware history.

begin;
create extension if not exists pgtap with schema extensions;

select plan(19);

insert into auth.users (id, email) values ('11111111-1111-4111-8111-111111111111', 'a@test.local');
insert into public.profiles (id, display_name, color)
values ('11111111-1111-4111-8111-111111111111', 'A', 'person-1');

insert into public.locations (id, name) values
  ('10000000-0000-4000-8000-000000000001', 'Studio Eins'),
  ('10000000-0000-4000-8000-000000000002', 'Studio Zwei');
insert into public.exercises (id, name, measure) values
  ('e0000000-0000-4000-8000-000000000001', 'Test-Beinpresse', 'weight_reps'),
  ('e0000000-0000-4000-8000-000000000002', 'Test-Kurzhantel', 'weight_reps');
insert into public.device_types (id, name, comparable) values
  ('70000000-0000-4000-8000-000000000001', 'Test-Presse', false),
  ('70000000-0000-4000-8000-000000000002', 'Test-Hanteln', true),
  ('70000000-0000-4000-8000-000000000003', 'Test-Presse neu', false);
insert into public.devices (id, location_id, device_type_id) values
  ('d0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001'),
  ('d0000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000001'),
  ('d0000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000002'),
  ('d0000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000002');
insert into public.training_prefs (user_id, home_location_id)
values ('11111111-1111-4111-8111-111111111111', '10000000-0000-4000-8000-000000000001');

create schema tests;
grant usage on schema tests to authenticated;
create function tests.type_id(p_name text) returns uuid language sql stable as $$
  select id from public.training_types where name = p_name and owner_id is null
$$;
grant execute on function tests.type_id(text) to authenticated;

-- History fixtures: a finished workout at each studio with both exercises.
create function tests.past_workout(p_location uuid, p_press uuid, p_bells uuid, p_kg numeric)
returns void language plpgsql as $$
declare w uuid := gen_random_uuid(); i1 uuid := gen_random_uuid(); i2 uuid := gen_random_uuid();
begin
  insert into public.workouts (id, user_id, training_type_id, location_id, status, started_at, ended_at)
  values (w, '11111111-1111-4111-8111-111111111111', tests.type_id('Studio'), p_location,
          'finished', now() - (p_kg || ' minutes')::interval, now());
  insert into public.workout_items (id, workout_id, exercise_id, device_id, position) values
    (i1, w, 'e0000000-0000-4000-8000-000000000001', p_press, 0),
    (i2, w, 'e0000000-0000-4000-8000-000000000002', p_bells, 1);
  insert into public.workout_sets (item_id, position, weight_kg, reps, completed_at) values
    (i1, 0, p_kg, 10, now()), (i2, 0, p_kg / 10, 10, now());
end $$;
-- Older workout at studio 1 (100 kg), newer at studio 2 (60 kg).
select tests.past_workout('10000000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003', 100);
select tests.past_workout('10000000-0000-4000-8000-000000000002',
  'd0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000004', 60);

set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

-- Default places
select is((select location_id from public.start_workout(tests.type_id('Studio'))),
  '10000000-0000-4000-8000-000000000001'::uuid, 'Studio starts at the home studio');
select public.finish_workout((select id from public.workouts where status = 'active'));
select isnt((select location_id from public.start_workout(tests.type_id('Home Gym'))),
  null, 'Home Gym starts at a private place');
select is((select owner_id from public.locations l join public.workouts w on w.location_id = l.id
            where w.status = 'active'),
  '11111111-1111-4111-8111-111111111111'::uuid, 'the private place is created on first use');
select public.finish_workout((select id from public.workouts where status = 'active'));
select is((select location_id from public.start_workout(tests.type_id('Laufen'))),
  null, 'Laufen has no place');
select lives_ok($$update public.workouts set variant = 'Laufband' where status = 'active'$$,
  'workouts record a variant');

-- Device-aware history
select results_eq(
  $$select weight_kg, same_device from public.previous_sets(
      'e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001')$$,
  $$values (100.00::numeric, true)$$,
  'a machine compares with itself, even if another studio was used more recently');
select results_eq(
  $$select weight_kg, same_device from public.previous_sets(
      'e0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000003')$$,
  $$values (6.00::numeric, true)$$,
  'comparable devices share one history across studios (latest wins)');
select results_eq(
  $$select count(*) from public.exercise_trend(
      'e0000000-0000-4000-8000-000000000001', 6, 'd0000000-0000-4000-8000-000000000002')$$,
  $$values (1::bigint)$$,
  'the trend of a machine only includes that machine');
reset role;

insert into public.devices (id, location_id, device_type_id)
values ('d0000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000001',
        '70000000-0000-4000-8000-000000000003');
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select results_eq(
  $$select same_device from public.previous_sets(
      'e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000009') limit 1$$,
  $$values (false)$$,
  'a new machine falls back to other devices, marked as "other device"');
reset role;

-- Overview for the exercise picker
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select results_eq(
  $$select scope_device_id, last_weight_kg from public.exercise_overview()
     where exercise_id = 'e0000000-0000-4000-8000-000000000001' order by last_weight_kg$$,
  $$values ('d0000000-0000-4000-8000-000000000002'::uuid, 60.00::numeric),
           ('d0000000-0000-4000-8000-000000000001'::uuid, 100.00::numeric)$$,
  'overview keeps one history per machine');
select results_eq(
  $$select scope_device_id, trend from public.exercise_overview()
     where exercise_id = 'e0000000-0000-4000-8000-000000000002'$$,
  $$values (null::uuid, array[13.33, 8.00]::numeric[])$$,
  'comparable devices share one history (oldest first)');
select lives_ok(
  $$insert into public.device_type_exercises (device_type_id, exercise_id)
    values ('70000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002')$$,
  'anyone may link an exercise to a device type');
select lives_ok(
  $$insert into public.device_hidden_exercises (device_id, exercise_id)
    values ('d0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000002')$$,
  'anyone may hide an exercise at a public studio device');
select lives_ok(
  $$update public.workouts set focus_id = (select id from public.training_focuses where name = 'Push')
     where status = 'active'$$,
  'workouts record a training focus');
reset role;

-- A newer workout without a device must not push the machine's own history aside.
do $$
declare w uuid := gen_random_uuid(); i uuid := gen_random_uuid();
begin
  insert into public.workouts (id, user_id, training_type_id, location_id, status, started_at, ended_at)
  values (w, '11111111-1111-4111-8111-111111111111', tests.type_id('Studio'), null,
          'finished', now(), now());
  insert into public.workout_items (id, workout_id, exercise_id, device_id, position)
  values (i, w, 'e0000000-0000-4000-8000-000000000001', null, 0);
  insert into public.workout_sets (item_id, position, weight_kg, reps, completed_at)
  values (i, 0, 5, 10, now());
end $$;
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select results_eq(
  $$select weight_kg, same_device from public.previous_sets(
      'e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001')$$,
  $$values (100.00::numeric, true)$$,
  'a newer workout without a device does not hide the machine''s own history');

-- Exercise history: per workout, scoped like the history, or across all devices
select results_eq(
  $$select best_weight_kg, best_reps, volume_kg, jsonb_array_length(sets)
      from public.exercise_sessions(
        'e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001')$$,
  $$values (100.00::numeric, 10, 1000.00::numeric, 1)$$,
  'sessions of a machine: best set, volume and sets');
select is(
  (select count(*) from public.exercise_sessions(
     'e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', true)),
  3::bigint, '"alle Geräte" includes other machines and no device');
select results_eq(
  $$select kind, weight_kg, reps from public.exercise_records(
      'e0000000-0000-4000-8000-000000000001', null, true)
     where kind in ('best', 'heaviest') order by kind$$,
  $$values ('best'::text, 100.00::numeric, 10), ('heaviest'::text, 100.00::numeric, 10)$$,
  'records: best and heaviest set');
select is(
  (select count(*) from public.exercise_records(
     'e0000000-0000-4000-8000-000000000001', null, true) where kind = 'reps_at_weight'),
  3::bigint, 'one rep record per weight');
reset role;

select * from finish();
rollback;
