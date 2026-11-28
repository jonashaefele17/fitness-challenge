-- Training days of a group's members (8c-1): a local day with at least one finished workout
-- counts once; unfinished workouts do not count; only the range; the time zone decides the
-- day; only members of the group get anything, and only about that group's members.
--   a1, a2 are in group A · b is in group B

begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'a1@test.local'),
  ('22222222-2222-4222-8222-222222222222', 'a2@test.local'),
  ('33333333-3333-4333-8333-333333333333', 'b@test.local');
insert into public.profiles (id, display_name, color) values
  ('11111111-1111-4111-8111-111111111111', 'A1', 'person-1'),
  ('22222222-2222-4222-8222-222222222222', 'A2', 'person-2'),
  ('33333333-3333-4333-8333-333333333333', 'B', 'person-3');
insert into public.groups (id, name) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'B');
insert into public.group_members (group_id, user_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '33333333-3333-4333-8333-333333333333');

create schema tests;
grant usage on schema tests to authenticated;
-- A workout of a person starting at a moment, finished an hour later unless unfinished.
create function tests.workout(p_user uuid, p_start timestamptz, p_finished boolean default true)
returns void language sql security definer set search_path = '' as $$
  insert into public.workouts (user_id, training_type_id, status, started_at, ended_at)
  values (p_user,
          (select id from public.training_types where name = 'Studio' and owner_id is null),
          case when p_finished then 'finished'::public.workout_status
               else 'active'::public.workout_status end,
          p_start,
          case when p_finished then p_start + interval '1 hour' end);
$$;

-- a1: 01.12. twice · 03.12. · 03.12. 00:30 Berlin (= 02.12. 23:30 UTC) · 10.12. (outside)
--     · an unfinished one on 05.12.
select tests.workout('11111111-1111-4111-8111-111111111111', '2026-12-01 08:00+01');
select tests.workout('11111111-1111-4111-8111-111111111111', '2026-12-01 18:00+01');
select tests.workout('11111111-1111-4111-8111-111111111111', '2026-12-03 00:30+01');
select tests.workout('11111111-1111-4111-8111-111111111111', '2026-12-10 10:00+01');
select tests.workout('11111111-1111-4111-8111-111111111111', '2026-12-05 10:00+01', false);
-- a2: 04.12. · 30.11. (before the range)
select tests.workout('22222222-2222-4222-8222-222222222222', '2026-12-04 10:00+01');
select tests.workout('22222222-2222-4222-8222-222222222222', '2026-11-30 10:00+01');
-- b: 02.12.
select tests.workout('33333333-3333-4333-8333-333333333333', '2026-12-02 10:00+01');

set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

select results_eq(
  $$select user_id, on_date from public.group_training_days(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2026-12-01', '2026-12-07', 'Europe/Berlin')$$,
  $$values ('11111111-1111-4111-8111-111111111111'::uuid, '2026-12-01'::date),
           ('11111111-1111-4111-8111-111111111111'::uuid, '2026-12-03'::date),
           ('22222222-2222-4222-8222-222222222222'::uuid, '2026-12-04'::date)$$,
  'a member gets the training days of the group''s members in the range');
select is(
  (select count(*) from public.group_training_days(
     'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2026-12-01', '2026-12-01', 'Europe/Berlin')),
  1::bigint, 'a day with two workouts counts once');
select is(
  (select count(*) from public.group_training_days(
     'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2026-12-05', '2026-12-05', 'Europe/Berlin')),
  0::bigint, 'an unfinished workout does not count');
select results_eq(
  $$select on_date from public.group_training_days(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2026-11-30', '2026-12-31', 'Europe/Berlin')
     where user_id = '22222222-2222-4222-8222-222222222222'$$,
  $$values ('2026-11-30'::date), ('2026-12-04'::date)$$,
  'a wider range takes the days before and after too');
select is(
  (select count(*) from public.group_training_days(
     'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2026-12-08', '2026-12-09', 'Europe/Berlin')),
  0::bigint, 'nothing in a range without trainings');
select results_eq(
  $$select on_date from public.group_training_days(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2026-12-02', '2026-12-03', 'UTC')$$,
  $$values ('2026-12-02'::date)$$,
  'in UTC the late workout is on the day before');
select results_eq(
  $$select on_date from public.group_training_days(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2026-12-02', '2026-12-03', 'Europe/Berlin')$$,
  $$values ('2026-12-03'::date)$$,
  'in Berlin it is on its local day');
select is(
  (select count(*) from public.group_training_days(
     'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '2026-12-01', '2026-12-07', 'Europe/Berlin')),
  0::bigint, 'a member of A gets nothing from group B');

-- b (group B)
set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select is(
  (select count(*) from public.group_training_days(
     'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2026-12-01', '2026-12-07', 'Europe/Berlin')),
  0::bigint, 'a member of B gets nothing from group A');
select results_eq(
  $$select user_id, on_date from public.group_training_days(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '2026-12-01', '2026-12-07', 'Europe/Berlin')$$,
  $$values ('33333333-3333-4333-8333-333333333333'::uuid, '2026-12-02'::date)$$,
  'group B holds only its own member''s days');

-- Not signed in
reset role;
set local role anon;
select throws_ok(
  $$select * from public.group_training_days(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2026-12-01', '2026-12-07', 'Europe/Berlin')$$,
  '42501', null, 'anon cannot call group_training_days');
reset role;
select is((select count(*) from public.workouts), 8::bigint, 'all workouts are still there');

select * from finish();
rollback;
