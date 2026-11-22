-- Habits in the feed (6d-3): Monday's look back and milestones, only for shared habits,
-- not before 7:00, once; the other group sees nothing.
--   a1 shares sleep and keeps focus time private · a2 is in group A · b is in group B

begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

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
create function tests.events(p_type text) returns bigint language sql as $$
  select count(*) from public.feed_events where type = p_type
$$;
grant execute on all functions in schema tests to authenticated;

-- Two weeks of sleep met (Mon 30.11. to Sun 13.12.), focus time too but private.
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select public.save_habit(null, (select id from public.habit_templates where key = k), '2026-11-30', '{}')
  from unnest(array['sleep', 'focus']) k;
select public.set_habit_entry(h.id, d::date, '{"start":"23:00","end":"07:00"}')
  from public.habits h join public.habit_versions v on v.habit_id = h.id,
       generate_series(date '2026-11-30', date '2026-12-13', interval '1 day') d
 where v.name = 'Schlaf';
select public.set_habit_entry(h.id, d::date, '{"minutes":240}')
  from public.habits h join public.habit_versions v on v.habit_id = h.id,
       generate_series(date '2026-11-30', date '2026-12-13', interval '1 day') d
 where v.name = 'Fokuszeit';
update public.habits set share_level = 'done'
 where id = (select h.id from public.habits h join public.habit_versions v on v.habit_id = h.id where v.name = 'Schlaf');
reset role;

select is(private.post_habit_feed('2026-12-14 06:30+01'), 0, 'nothing before 7:00');
select is(private.post_habit_feed('2026-12-14 07:30+01'), 2, 'Monday 7:30: the look back and a milestone');
select is(
  (select data ->> 'weekStart' from public.feed_events where type = 'habit_week'),
  '2026-12-07', 'about last week');
select results_eq(
  $$select data ->> 'milestone', data ->> 'name' from public.feed_events where type = 'habit_milestone'$$,
  $$values ('7', 'Schlaf')$$,
  'the shared habit kept up for 7 days; nothing about the private one');
select is(private.post_habit_feed('2026-12-14 08:30+01'), 0, 'once');
select is(private.post_habit_feed('2026-12-15 07:30+01'), 0, 'Tuesday: no look back, no milestone again');

set local role authenticated;
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';
select is(tests.events('habit_week') + tests.events('habit_milestone'), 2::bigint, 'the group sees both');
set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select is(tests.events('habit_week') + tests.events('habit_milestone'), 0::bigint, 'another group sees nothing');
reset role;

select * from finish();
rollback;
