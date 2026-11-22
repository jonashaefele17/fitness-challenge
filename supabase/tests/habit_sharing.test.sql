-- Sharing habits (6d-1): private ones nobody else sees; "nur erledigt" shows whether it was
-- met but no values; "mit Werten" shows the values too; other groups see nothing; nobody
-- changes someone else's sharing.
--   a1 shares, a2 is in the same group · b is in another group

begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

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
create function tests.habit(p_name text) returns uuid language sql security definer set search_path = '' as $$
  select h.id from public.habits h join public.habit_versions v on v.habit_id = h.id where v.name = p_name limit 1
$$;
grant execute on all functions in schema tests to authenticated;

set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select public.save_habit(null, (select id from public.habit_templates where key = k), '2026-11-30', '{}')
  from unnest(array['sleep', 'screen_time', 'focus']) k;
select public.set_habit_entry(tests.habit('Schlaf'), '2026-12-01', '{"start":"23:00","end":"07:00"}');
select public.set_habit_entry(tests.habit('Screen-Time'), '2026-12-01', '{"minutes":90}');
select public.set_habit_entry(tests.habit('Fokuszeit'), '2026-12-01', '{"minutes":150}');
update public.habits set share_level = 'values' where id = tests.habit('Schlaf');
update public.habits set share_level = 'done' where id = tests.habit('Screen-Time');

set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';
select is((select count(*) from public.habits), 2::bigint, 'a group mate sees the shared habits only');
select results_eq(
  $$select name, state, value is not null from public.habit_days(
      '11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-01', '2026-12-10') order by name$$,
  $$values ('Schlaf'::text, 'done'::text, true), ('Screen-Time'::text, 'done'::text, false)$$,
  'how the shared ones went; values only where shared with values');
select is(
  (select avg_value from public.habit_summary('11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-01', '2026-12-10')
    where habit_id = tests.habit('Screen-Time')),
  null, '"nur erledigt": no averages of values');
select is(
  (select avg_duration from public.habit_summary('11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-01', '2026-12-10')
    where habit_id = tests.habit('Schlaf')),
  480, '"mit Werten": the values count');
select is((select count(*) from public.habit_entries where habit_id = tests.habit('Screen-Time')), 0::bigint,
  'the entries of a "nur erledigt" habit stay hidden');
select is((select count(*) from public.habit_entries where habit_id = tests.habit('Schlaf')), 1::bigint,
  'those of a "mit Werten" habit can be read');
update public.habits set share_level = 'private' where id = tests.habit('Schlaf');
reset role;
select is((select share_level from public.habits where id = tests.habit('Schlaf')), 'values',
  'nobody changes someone else''s sharing');

set local role authenticated;
set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select is((select count(*) from public.habits), 0::bigint, 'another group sees no habits');
select is((select count(*) from public.habit_days('11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-01', '2026-12-10')),
  0::bigint, 'nor how they went');
select is((select count(*) from public.habit_stats('11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-01', '2026-12-10')),
  0::bigint, 'nor their figures');

select * from finish();
rollback;
