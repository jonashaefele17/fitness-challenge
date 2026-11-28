-- Season strength (8c-3): season_strength_weeks with concrete numbers. Season "Winter" of
-- group A from Monday 30.11.2026 to Sunday 21.02.2027, evaluated on Wednesday 16.12.2026.
--   a1: two strength goals at 5 reps – Bank from 100 kg (a set of 100 × 5 on 20.11. before
--       the season does not count; 105 × 5 on 02.12.: +5 %) and Rudern from 50 kg (55 × 5
--       on 09.12.: +10 %); an archived strength goal with a set that would pull the mean.
--   a2: one strength goal (Bank from 80 kg) without a set yet: 0 %.
--   a3: only a weight goal – no strength rows.
--   b:  member of group B only.

begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'a1@test.local'),
  ('22222222-2222-4222-8222-222222222222', 'a2@test.local'),
  ('33333333-3333-4333-8333-333333333333', 'a3@test.local'),
  ('55555555-5555-4555-8555-555555555555', 'b@test.local');
insert into public.profiles (id, display_name, color) values
  ('11111111-1111-4111-8111-111111111111', 'A1', 'person-1'),
  ('22222222-2222-4222-8222-222222222222', 'A2', 'person-2'),
  ('33333333-3333-4333-8333-333333333333', 'A3', 'person-3'),
  ('55555555-5555-4555-8555-555555555555', 'B', 'person-5');
insert into public.groups (id, name) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'B');
insert into public.group_members (group_id, user_id, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'admin'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'member'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333', 'member'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '55555555-5555-4555-8555-555555555555', 'admin');

insert into public.exercises (id, name, measure) values
  ('e0000000-0000-4000-8000-000000000001', 'Test-Bank', 'weight_reps'),
  ('e0000000-0000-4000-8000-000000000002', 'Test-Rudern', 'weight_reps'),
  ('e0000000-0000-4000-8000-000000000003', 'Test-Kniebeuge', 'weight_reps');

create schema tests;
grant usage on schema tests to authenticated;
create function tests.login(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;
-- A finished training of a person at 10:00 Berlin time with one set of an exercise.
create function tests.set(p_user uuid, p_day date, p_exercise uuid, p_kg numeric, p_reps integer)
returns void language plpgsql as $$
declare w uuid := gen_random_uuid(); i uuid := gen_random_uuid();
begin
  insert into public.workouts (id, user_id, training_type_id, status, started_at, ended_at)
  values (w, p_user,
          (select id from public.training_types where name = 'Studio' and owner_id is null),
          'finished', (p_day + time '10:00') at time zone 'Europe/Berlin',
          (p_day + time '11:00') at time zone 'Europe/Berlin');
  insert into public.workout_items (id, workout_id, exercise_id, position)
  values (i, w, p_exercise, 0);
  insert into public.workout_sets (item_id, position, weight_kg, reps, is_warmup, completed_at)
  values (i, 0, p_kg, p_reps, false, now());
end $$;
grant execute on all functions in schema tests to authenticated;

insert into public.seasons (id, group_id, name, setup_opens_on, starts_on, ends_on)
values ('5e000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'Winter', '2026-11-23', '2026-11-30', '2027-02-21');
insert into public.season_members (season_id, user_id, starts_on, ready_at, added_at) values
  ('5e000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   '2026-11-30', now(), '2026-11-23 10:00+01'),
  ('5e000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222',
   '2026-11-30', now(), '2026-11-23 10:01+01'),
  ('5e000000-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333',
   '2026-11-30', now(), '2026-11-23 10:02+01');

insert into public.goals (id, user_id, metric, exercise_id, reps, starts_on, ends_on,
                          start_value, visibility, archived_at) values
  ('90000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'exercise_best', 'e0000000-0000-4000-8000-000000000001', 5, '2026-11-30', '2027-02-21',
   100, 'shared', null),
  ('90000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   'exercise_best', 'e0000000-0000-4000-8000-000000000002', 5, '2026-11-30', '2027-02-21',
   50, 'private', null),
  ('90000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   'exercise_best', 'e0000000-0000-4000-8000-000000000003', 5, '2026-11-30', '2027-02-21',
   100, 'shared', '2026-12-01 10:00+01'),
  ('90000000-0000-4000-8000-000000000004', '22222222-2222-4222-8222-222222222222',
   'exercise_best', 'e0000000-0000-4000-8000-000000000001', 5, '2026-11-30', '2027-02-21',
   80, 'shared', null),
  ('90000000-0000-4000-8000-000000000005', '33333333-3333-4333-8333-333333333333',
   'body_weight', null, null, '2026-11-30', '2027-02-21', 85, 'shared', null);
insert into public.goal_versions (goal_id, valid_from, min_value, target_value) values
  ('90000000-0000-4000-8000-000000000001', '2026-11-30', null, 110),
  ('90000000-0000-4000-8000-000000000002', '2026-11-30', null, 60),
  ('90000000-0000-4000-8000-000000000003', '2026-11-30', null, 120),
  ('90000000-0000-4000-8000-000000000004', '2026-11-30', null, 90),
  ('90000000-0000-4000-8000-000000000005', '2026-11-30', null, 80);
insert into public.season_goals (season_id, user_id, goal_id)
select '5e000000-0000-4000-8000-000000000001', g.user_id, g.id from public.goals g;

select tests.set('11111111-1111-4111-8111-111111111111', '2026-11-20',
                 'e0000000-0000-4000-8000-000000000001', 100, 5);
select tests.set('11111111-1111-4111-8111-111111111111', '2026-12-02',
                 'e0000000-0000-4000-8000-000000000001', 105, 5);
select tests.set('11111111-1111-4111-8111-111111111111', '2026-12-09',
                 'e0000000-0000-4000-8000-000000000002', 55, 5);
select tests.set('11111111-1111-4111-8111-111111111111', '2026-12-02',
                 'e0000000-0000-4000-8000-000000000003', 150, 5);

set local role authenticated;
select tests.login('22222222-2222-4222-8222-222222222222');

select results_eq(
  $$select on_date, strength_pct from public.season_strength_weeks(
      '5e000000-0000-4000-8000-000000000001', '2026-12-16', 'Europe/Berlin')
     where user_id = '11111111-1111-4111-8111-111111111111'$$,
  $$values ('2026-11-30'::date, 0.0::numeric), ('2026-12-06'::date, 2.5::numeric),
           ('2026-12-13'::date, 7.5::numeric), ('2026-12-16'::date, 7.5::numeric)$$,
  'a1: the mean of +5 % and +10 % per week end and today – a goal without a set yet counts 0 %, the set before the start and the archived goal do not count');

select results_eq(
  $$select on_date, strength_pct from public.season_strength_weeks(
      '5e000000-0000-4000-8000-000000000001', '2026-12-16', 'Europe/Berlin')
     where user_id = '22222222-2222-4222-8222-222222222222'$$,
  $$values ('2026-11-30'::date, 0.0::numeric), ('2026-12-06'::date, 0.0::numeric),
           ('2026-12-13'::date, 0.0::numeric), ('2026-12-16'::date, 0.0::numeric)$$,
  'a2: a goal without a set is 0 % on every point');

select ok(
  not exists (select 1 from public.season_strength_weeks(
      '5e000000-0000-4000-8000-000000000001', '2026-12-16', 'Europe/Berlin')
     where user_id = '33333333-3333-4333-8333-333333333333'),
  'a3 without a strength goal has no rows');

-- A weaker best than the start goes below 0.
reset role;
update public.goals set start_value = 110 where id = '90000000-0000-4000-8000-000000000001';
set local role authenticated;
select tests.login('22222222-2222-4222-8222-222222222222');
select is(
  (select strength_pct from public.season_strength_weeks(
      '5e000000-0000-4000-8000-000000000001', '2026-12-06', 'Europe/Berlin')
    where user_id = '11111111-1111-4111-8111-111111111111' and on_date = '2026-12-06'),
  -2.3::numeric, 'below the start: 105 of 110 kg is −4.5 %, with the goal without a set −2.3 %');

select ok(
  not exists (select 1 from public.season_strength_weeks(
      '5e000000-0000-4000-8000-000000000001', '2026-11-29', 'Europe/Berlin')),
  'before the start there is no point');

select tests.login('55555555-5555-4555-8555-555555555555');
select is(
  (select count(*)::integer from public.season_strength_weeks(
      '5e000000-0000-4000-8000-000000000001', '2026-12-16', 'Europe/Berlin')),
  0, 'a member of group B gets nothing of group A''s season');

reset role;
select ok(
  not has_function_privilege('anon', 'public.season_strength_weeks(uuid, date, text)', 'execute'),
  'anon cannot call it');

select * from finish();
rollback;
