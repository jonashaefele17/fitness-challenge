-- Workouts, items and sets: ownership, visibility, transitions and history helpers.
--   a1, a2 share a group · b is in another group

begin;
create extension if not exists pgtap with schema extensions;

select plan(23);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'a1@test.local'),
  ('22222222-2222-4222-8222-222222222222', 'a2@test.local'),
  ('33333333-3333-4333-8333-333333333333', 'b@test.local');
insert into public.profiles (id, display_name, color) values
  ('11111111-1111-4111-8111-111111111111', 'A1', 'person-1'),
  ('22222222-2222-4222-8222-222222222222', 'A2', 'person-2'),
  ('33333333-3333-4333-8333-333333333333', 'B', 'person-3');
insert into public.groups (id, name) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'A'), ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'B');
insert into public.group_members (group_id, user_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '33333333-3333-4333-8333-333333333333');

insert into public.exercises (id, name, measure) values
  ('e0000000-0000-4000-8000-000000000001', 'Test-Bankdrücken', 'weight_reps');
insert into public.training_types (id, name, kind, owner_id) values
  ('70000000-0000-4000-8000-000000000001', 'B-Privat', 'exercises', '33333333-3333-4333-8333-333333333333');

create schema tests;
grant usage on schema tests to authenticated;
create function tests.type_id(p_name text) returns uuid language sql stable as $$
  select id from public.training_types where name = p_name and owner_id is null
$$;
grant execute on function tests.type_id(text) to authenticated;

-- ---------------------------------------------------------------------------
-- a1 trains
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

select lives_ok($$select public.start_workout(tests.type_id('Studio'))$$, 'starting a workout');
select throws_ok($$select public.start_workout(tests.type_id('Studio'))$$,
  'P0001', 'workout_already_active', 'only one running workout per person');
select throws_ok($$select public.start_workout('70000000-0000-4000-8000-000000000001')$$,
  'P0001', 'invalid_training_type', 'personal types of others cannot be used');

insert into public.workout_items (id, workout_id, exercise_id, position)
select 'a0000000-0000-4000-8000-000000000001', id, 'e0000000-0000-4000-8000-000000000001', 0
  from public.workouts where status = 'active';
insert into public.workout_items (id, workout_id, exercise_id, position)
select 'a0000000-0000-4000-8000-000000000002', id, 'e0000000-0000-4000-8000-000000000001', 1
  from public.workouts where status = 'active';
insert into public.workout_sets (item_id, position, weight_kg, reps, is_warmup, completed_at) values
  ('a0000000-0000-4000-8000-000000000001', 0, 40, 10, true, now()),
  ('a0000000-0000-4000-8000-000000000001', 1, 70, 8, false, now()),
  ('a0000000-0000-4000-8000-000000000001', 2, 72.5, 6, false, now()),
  ('a0000000-0000-4000-8000-000000000001', 3, 72.5, null, false, null),
  ('a0000000-0000-4000-8000-000000000002', 0, 50, null, false, null);

select throws_ok(
  $$update public.workouts set status = 'finished', ended_at = now()$$,
  '42501', null, 'status changes only through finish_workout');
select throws_ok(
  $$update public.workouts set user_id = '22222222-2222-4222-8222-222222222222'$$,
  '42501', null, 'a workout cannot be handed to someone else');
reset role;

-- ---------------------------------------------------------------------------
-- a2 (same group) can watch, not touch
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';
select is((select count(*) from public.workout_sets), 5::bigint, 'group mates see sets (live)');
select throws_ok(
  $$insert into public.workout_items (workout_id, exercise_id, position)
    select id, 'e0000000-0000-4000-8000-000000000001', 5 from public.workouts$$,
  '42501', null, 'nobody adds exercises to someone else''s workout');
update public.workout_sets set reps = 99;
delete from public.workouts;
select throws_ok(
  $$select public.finish_workout((select id from public.workouts limit 1))$$,
  'P0001', 'workout_not_found', 'nobody finishes someone else''s workout');
reset role;
select is((select count(*) from public.workout_sets where reps = 99), 0::bigint,
  'others cannot change sets');
select is((select count(*) from public.workouts), 1::bigint, 'others cannot delete a workout');

-- ---------------------------------------------------------------------------
-- b (other group) sees nothing
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select is((select count(*) from public.workouts), 0::bigint, 'other groups see no workouts');
select is((select count(*) from public.workout_sets), 0::bigint, 'other groups see no sets');
reset role;

-- ---------------------------------------------------------------------------
-- Finishing and history
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select lives_ok($$select public.finish_workout((select id from public.workouts where status = 'active'))$$,
  'finishing my workout');
select is((select count(*) from public.workout_sets), 3::bigint, 'unticked sets are dropped');
select is((select count(*) from public.workout_items), 1::bigint, 'exercises without sets are dropped');
select isnt((select ended_at from public.workouts), null, 'finished workouts have an end time');

select results_eq(
  $$select set_position, weight_kg, reps, is_warmup
      from public.previous_sets('e0000000-0000-4000-8000-000000000001')$$,
  $$values (0, 40.00::numeric, 10, true), (1, 70.00::numeric, 8, false), (2, 72.50::numeric, 6, false)$$,
  'previous_sets returns the ticked sets of the last workout');
select results_eq(
  $$select value from public.exercise_trend('e0000000-0000-4000-8000-000000000001')$$,
  $$values (86.73::numeric)$$,
  'exercise_trend scores the best working set (Lombardi: 72.5 × 6 beats 70 × 8; warm-ups excluded)');

-- Duration entries
select lives_ok(
  $$with w as (select * from public.start_workout(tests.type_id('Laufen')))
    update public.workouts set duration_seconds = 2700, distance_m = 8000, intensity = 3
     where id = (select id from w)$$,
  'duration workouts store duration, distance and intensity');
select throws_ok(
  $$update public.workouts set intensity = 7 where status = 'active'$$,
  '23514', null, 'intensity is 1–5');
reset role;

-- Comparison: a group mate may read a1's exercise sessions, another group may not.
set local role authenticated;
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';
select is(
  (select count(*) from public.exercise_sessions('e0000000-0000-4000-8000-000000000001', null, true,
     '11111111-1111-4111-8111-111111111111')),
  1::bigint, 'group mates see each other''s exercise sessions');
select is(
  (select count(*) from public.exercise_sessions('e0000000-0000-4000-8000-000000000001', null, true)),
  0::bigint, 'without a person it is my own history');
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select is(
  (select count(*) from public.exercise_sessions('e0000000-0000-4000-8000-000000000001', null, true,
     '11111111-1111-4111-8111-111111111111')),
  0::bigint, 'other groups see no exercise sessions');
reset role;

select * from finish();
rollback;
