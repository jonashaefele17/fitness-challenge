-- Progression suggestions (double progression) and new bests of a workout.

begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

insert into auth.users (id, email) values ('11111111-1111-4111-8111-111111111111', 'a@test.local');
insert into public.profiles (id, display_name, color)
values ('11111111-1111-4111-8111-111111111111', 'A', 'person-1');
insert into public.exercises (id, name, measure) values
  ('e0000000-0000-4000-8000-000000000001', 'Test-Presse', 'weight_reps');
insert into public.device_types (id, name, default_weight_step) values
  ('70000000-0000-4000-8000-000000000001', 'Test-Maschine', 2.5);
insert into public.locations (id, name) values ('10000000-0000-4000-8000-000000000001', 'Studio');
insert into public.devices (id, location_id, device_type_id) values
  ('d0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   '70000000-0000-4000-8000-000000000001');

create schema tests;
create function tests.workout(p_minutes_ago integer, p_sets numeric[][]) returns uuid
language plpgsql as $$
declare w uuid := gen_random_uuid(); i uuid := gen_random_uuid(); n integer;
begin
  insert into public.workouts (id, user_id, training_type_id, status, started_at, ended_at)
  values (w, '11111111-1111-4111-8111-111111111111',
          (select id from public.training_types where name = 'Studio' and owner_id is null),
          'finished', now() - (p_minutes_ago || ' minutes')::interval, now());
  insert into public.workout_items (id, workout_id, exercise_id, device_id, position)
  values (i, w, 'e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 0);
  for n in 1 .. array_length(p_sets, 1) loop
    insert into public.workout_sets (item_id, position, weight_kg, reps, completed_at)
    values (i, n - 1, p_sets[n][1], p_sets[n][2]::integer, now());
  end loop;
  return w;
end $$;
create table tests.ids (key text primary key, id uuid);
grant usage on schema tests to authenticated;
grant all on tests.ids to authenticated;

insert into tests.ids values ('w1', tests.workout(200, array[[50, 10], [50, 12]]));

set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select results_eq(
  $$select go_up, suggested_weight_kg, last_weight_kg, last_reps from public.exercise_progression(
      'e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 8, 12)$$,
  $$values (true, 52.50::numeric, 50.00::numeric, 12)$$,
  'top of the rep range reached: next weight step of the device');
select results_eq(
  $$select go_up, suggested_weight_kg from public.exercise_progression(
      'e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 8, 15)$$,
  $$values (false, 50.00::numeric)$$,
  'below the top: keep the weight');
select results_eq(
  $$select rep_max, go_up from public.exercise_progression('e0000000-0000-4000-8000-000000000001')$$,
  $$values (null::integer, false)$$,
  'without a rep range there is no ↑');
select lives_ok(
  $$select public.save_template(null, 'Push', (select id from public.training_types where name = 'Studio' and owner_id is null),
      null, null,
      '[{"exerciseId": "e0000000-0000-4000-8000-000000000001", "sets": 3, "repMin": 8, "repMax": 10}]'::jsonb)$$,
  'a template with a rep range');
select results_eq(
  $$select rep_min, rep_max, go_up from public.exercise_progression('e0000000-0000-4000-8000-000000000001')$$,
  $$values (8, 10, true)$$,
  'free workouts take the rep range of my template with the exercise');
reset role;

insert into tests.ids values ('w2', tests.workout(100, array[[52.5, 9], [52.5, 8]]));
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select results_eq(
  $$select weight_kg, reps, previous_weight_kg, previous_reps
      from public.workout_records((select id from tests.ids where key = 'w2'))$$,
  $$values (52.50::numeric, 9, 50.00::numeric, 12)$$,
  'a better best set than ever before is a new best (with the old one)');
select is(
  (select count(*) from public.workout_records((select id from tests.ids where key = 'w1'))),
  0::bigint, 'the first workout with an exercise has nothing to beat');
reset role;

select * from finish();
rollback;
