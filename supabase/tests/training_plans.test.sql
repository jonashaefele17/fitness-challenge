-- Plans (5a): once or weekly; a date can be cancelled; a workout started from a plan marks
-- the date done; the group sees them, other groups do not; only the owner changes them.
--   a1, a2 share group A · b is in group B

begin;
create extension if not exists pgtap with schema extensions;

select plan(13);

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

create schema tests;
grant usage on schema tests to authenticated;
create function tests.studio() returns uuid language sql stable as $$
  select id from public.training_types where name = 'Studio' and owner_id is null
$$;
grant execute on function tests.studio() to authenticated;

set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
-- Mondays and Thursdays in December 2026 (Mon 7, 14, 21, 28 · Thu 3, 10, 17, 24, 31)
select lives_ok(
  $$insert into public.plans (id, kind, training_type_id, starts_on, start_time, repeat_weekdays, repeat_until)
    values ('c0000000-0000-4000-8000-000000000001', 'training', tests.studio(), '2026-12-01', '18:00',
            '{1,4}', '2026-12-31')$$,
  'a weekly plan');
select lives_ok(
  $$insert into public.plans (id, kind, title, starts_on)
    values ('c0000000-0000-4000-8000-000000000002', 'event', 'Stadtlauf', '2026-12-13')$$,
  'an event once');
select throws_ok(
  $$insert into public.plans (kind, starts_on) values ('event', '2026-12-14')$$,
  '23514', null, 'an event needs a name');
select is(
  (select count(*) from public.plan_occurrences('11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-31')
    where plan_id = 'c0000000-0000-4000-8000-000000000001'),
  9::bigint, 'the series falls on every Monday and Thursday until its end');
select is(
  (select count(*) from public.plan_occurrences('11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-31')
    where kind = 'event'),
  1::bigint, 'the event once');

-- one date cancelled
insert into public.plan_skips (plan_id, on_date) values ('c0000000-0000-4000-8000-000000000001', '2026-12-07');
select is(
  (select status from public.plan_occurrences('11111111-1111-4111-8111-111111111111', '2026-12-07', '2026-12-07')),
  'cancelled', 'a cancelled date');

-- started from the plan and finished: done
select lives_ok(
  $$select public.start_workout(tests.studio(), null, null, 'c0000000-0000-4000-8000-000000000001', '2026-12-10')$$,
  'a workout starts from the plan');
select public.finish_workout((select id from public.workouts where status = 'active'));
select is(
  (select status from public.plan_occurrences('11111111-1111-4111-8111-111111111111', '2026-12-10', '2026-12-10')),
  'done', 'its date counts as done');
reset role;

-- the group sees the plans, other groups do not, nobody else changes them
set local role authenticated;
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';
select is(
  (select count(*) from public.plan_occurrences('11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-31')),
  10::bigint, 'a group mate sees them');
update public.plans set title = 'gehackt' where id = 'c0000000-0000-4000-8000-000000000002';
select throws_ok(
  $$insert into public.plan_skips (plan_id, on_date) values ('c0000000-0000-4000-8000-000000000001', '2026-12-14')$$,
  '42501', null, 'and cannot cancel a date of someone else');
select throws_ok(
  $$select public.start_workout(tests.studio(), null, null, 'c0000000-0000-4000-8000-000000000001', '2026-12-14')$$,
  'P0001', 'plan_not_found', 'nor start from their plan');
set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select is(
  (select count(*) from public.plan_occurrences('11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-31')),
  0::bigint, 'another group sees nothing');
reset role;
select is((select title from public.plans where id = 'c0000000-0000-4000-8000-000000000002'),
  'Stadtlauf', 'others cannot change a plan');

select * from finish();
rollback;
