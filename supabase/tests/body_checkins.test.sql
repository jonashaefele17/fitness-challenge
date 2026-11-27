-- Zwischenstand (7c): measurement kinds as global data, check-ins saved and skipped through
-- the functions only, the rhythm status, figures per kind, history, and that all of it is
-- private (tables and functions).
--   a1 measures · a2 is in the same group (measures too, later) · b is in another group

begin;
create extension if not exists pgtap with schema extensions;

select plan(42);

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

-- ---------------------------------------------------------------------------
-- Kinds: everyone reads, nobody writes
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select is((select count(*) from public.body_measurement_kinds), 6::bigint,
  'every signed-in person reads the kinds');

set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select results_eq(
  $$select key, unit, step from public.body_measurement_kinds order by sort$$,
  $$values ('bauch'::text, 'cm'::text, 0.5::numeric), ('taille', 'cm', 0.5), ('brust', 'cm', 0.5),
           ('huefte', 'cm', 0.5), ('oberarm', 'cm', 0.5), ('oberschenkel', 'cm', 0.5)$$,
  'six kinds in their order, in cm with a step of 0.5');
select throws_ok(
  $$insert into public.body_measurement_kinds (key, label, hint, sort) values ('hals', 'Hals', 'x', 70)$$,
  '42501', null, 'kinds cannot be added by clients');
select throws_ok(
  $$update public.body_measurement_kinds set label = 'X' where key = 'bauch'$$,
  '42501', null, 'kinds cannot be changed by clients');

-- ---------------------------------------------------------------------------
-- Saving
-- ---------------------------------------------------------------------------
select throws_ok(
  $$insert into public.body_checkins (on_date) values ('2026-11-01')$$,
  '42501', null, 'check-ins are not written directly');

select is(
  public.save_body_checkin('2026-11-01', '{"bauch": 90, "taille": 85, "oberarm": 35}',
    'c0000000-0000-4000-8000-000000000001'),
  'c0000000-0000-4000-8000-000000000001'::uuid, 'save creates the check-in with the client''s id');
select results_eq(
  $$select kind, value from public.body_measurements order by kind$$,
  $$values ('bauch'::text, 90.0::numeric), ('oberarm', 35.0), ('taille', 85.0)$$,
  'with its values');

select is(
  public.save_body_checkin('2026-11-01', '{"bauch": 89.5, "taille": 84}',
    'c0000000-0000-4000-8000-000000000099'),
  'c0000000-0000-4000-8000-000000000001'::uuid, 'a second save on the same day updates it');
select results_eq(
  $$select c.on_date, m.kind, m.value from public.body_measurements m
      join public.body_checkins c on c.id = m.checkin_id order by m.kind$$,
  $$values ('2026-11-01'::date, 'bauch'::text, 89.5::numeric), ('2026-11-01', 'taille', 84.0)$$,
  'values replaced, the omitted kind removed, still one check-in');

select throws_ok(
  $$select public.save_body_checkin('2026-11-02', '{"hals": 40}')$$,
  '22023', null, 'unknown kinds are rejected');
select throws_ok(
  $$select public.save_body_checkin('2026-11-02', '{"bauch": 9.5}')$$,
  '23514', null, 'too small values are rejected');
select throws_ok(
  $$select public.save_body_checkin('2026-11-02', '{"bauch": 301}')$$,
  '23514', null, 'too large values are rejected');
select throws_ok(
  $$select public.save_body_checkin('2026-11-02', '{"bauch": "80"}')$$,
  '23514', null, 'values must be numbers');

-- ---------------------------------------------------------------------------
-- Skipping
-- ---------------------------------------------------------------------------
select is(public.skip_body_checkin('2026-11-01'), 'c0000000-0000-4000-8000-000000000001'::uuid,
  'skipping a day that has a check-in returns it');
select results_eq(
  $$select c.skipped, (select count(*) from public.body_measurements m where m.checkin_id = c.id)
      from public.body_checkins c where c.on_date = '2026-11-01'$$,
  $$values (false, 2::bigint)$$,
  'and does not overwrite it');
select public.skip_body_checkin('2026-11-29', 'c0000000-0000-4000-8000-000000000002');
select results_eq(
  $$select c.id, c.skipped, (select count(*) from public.body_measurements m where m.checkin_id = c.id)
      from public.body_checkins c where c.on_date = '2026-11-29'$$,
  $$values ('c0000000-0000-4000-8000-000000000002'::uuid, true, 0::bigint)$$,
  'skipping creates a skipped check-in without data');

-- ---------------------------------------------------------------------------
-- Status
-- ---------------------------------------------------------------------------
select results_eq(
  $$select * from public.body_checkin_status('11111111-1111-4111-8111-111111111111', '2026-11-30')$$,
  $$values ('2026-11-29'::date, '2026-11-01'::date, null::integer, null::date, false, null::integer)$$,
  'no rhythm: never due; a skipped one is the last but not the last done');

set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';
insert into public.body_settings (checkin_every_weeks) values (4);
select results_eq(
  $$select * from public.body_checkin_status('22222222-2222-4222-8222-222222222222', '2026-12-01')$$,
  $$values (null::date, null::date, 4, '2026-12-01'::date, true, 0)$$,
  'a rhythm without any check-in: due today (the baseline)');
select public.save_body_checkin('2026-12-01', '{"bauch": 80}');
select results_eq(
  $$select due, days_until from public.body_checkin_status('22222222-2222-4222-8222-222222222222', '2026-12-28')$$,
  $$values (false, 1)$$,
  'after a check-in: not due a day before 4 weeks');
select results_eq(
  $$select next_due_on, due, days_until from public.body_checkin_status('22222222-2222-4222-8222-222222222222', '2026-12-29')$$,
  $$values ('2026-12-29'::date, true, 0)$$,
  'due again exactly 4 weeks later');

set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select throws_ok(
  $$insert into public.body_settings (checkin_every_weeks) values (13)$$,
  '23514', null, 'the rhythm is 1 to 12 weeks');
insert into public.body_settings (checkin_every_weeks) values (4);
-- last 29.11. (skipped) → next 27.12.; without the skip it would have been 29.11.
select results_eq(
  $$select next_due_on, due, days_until from public.body_checkin_status('11111111-1111-4111-8111-111111111111', '2026-12-26')$$,
  $$values ('2026-12-27'::date, false, 1)$$,
  'a skipped check-in moves the rhythm on');
select results_eq(
  $$select due, days_until from public.body_checkin_status('11111111-1111-4111-8111-111111111111', '2026-12-27')$$,
  $$values (true, 0)$$,
  'due on the day');
select results_eq(
  $$select due, days_until from public.body_checkin_status('11111111-1111-4111-8111-111111111111', '2026-12-30')$$,
  $$values (true, -3)$$,
  'still due after it, days_until negative');

-- ---------------------------------------------------------------------------
-- Figures per kind and history
--   bauch 91 → 89.5 → 88 · taille 86 → 84 · brust 100 (one value)
-- ---------------------------------------------------------------------------
select public.save_body_checkin('2026-10-01', '{"bauch": 91, "taille": 86, "brust": 100}');
select public.save_body_checkin('2026-12-27', '{"bauch": 88}', 'c0000000-0000-4000-8000-000000000003');
select results_eq(
  $$select kind, latest_value, latest_on, previous_value, previous_on, first_value, first_on,
           change_since_previous, change_since_first, value_count
      from public.body_measurement_stats('11111111-1111-4111-8111-111111111111')$$,
  $$values
    ('bauch'::text, 88.0::numeric, '2026-12-27'::date, 89.5::numeric, '2026-11-01'::date,
     91.0::numeric, '2026-10-01'::date, -1.5::numeric, -3.0::numeric, 3),
    ('taille', 84.0, '2026-11-01', 86.0, '2026-10-01', 86.0, '2026-10-01', -2.0, -2.0, 2),
    ('brust', 100.0, '2026-10-01', null, null, 100.0, '2026-10-01', null, null, 1)$$,
  'latest, previous, first and both changes with 3, 2 and 1 values (skipped ones count nothing)');
select results_eq(
  $$select on_date, value from public.body_measurement_history('11111111-1111-4111-8111-111111111111', 'bauch')$$,
  $$values ('2026-10-01'::date, 91.0::numeric), ('2026-11-01', 89.5), ('2026-12-27', 88.0)$$,
  'history of a kind, oldest first');

-- ---------------------------------------------------------------------------
-- Private: the same group and another group see nothing
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';
select is((select count(*) from public.body_checkins
            where user_id = '11111111-1111-4111-8111-111111111111'), 0::bigint,
  'same group: no check-ins of others');
select is((select count(*) from public.body_measurements m
            where m.checkin_id = 'c0000000-0000-4000-8000-000000000001'), 0::bigint,
  'same group: no measurements of others');
select is((select count(*) from public.body_checkin_status('11111111-1111-4111-8111-111111111111', '2026-12-01')),
  0::bigint, 'same group: no status');
select is((select count(*) from public.body_measurement_stats('11111111-1111-4111-8111-111111111111')),
  0::bigint, 'same group: no figures');
select is((select count(*) from public.body_measurement_history('11111111-1111-4111-8111-111111111111', 'bauch')),
  0::bigint, 'same group: no history');

select throws_ok(
  $$select public.save_body_checkin('2026-11-01', '{"bauch": 50}', 'c0000000-0000-4000-8000-000000000001')$$,
  '42501', null, 'cannot save into someone else''s check-in');
select throws_ok(
  $$insert into public.body_measurements (checkin_id, kind, value)
    values ('c0000000-0000-4000-8000-000000000001', 'bauch', 50)$$,
  '42501', null, 'cannot attach measurements to someone else''s check-in');
delete from public.body_checkins where id = 'c0000000-0000-4000-8000-000000000001';

set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select is((select count(*) from public.body_checkins), 0::bigint,
  'other group: no check-ins of others');
select is((select count(*) from public.body_measurements), 0::bigint,
  'other group: no measurements of others');
select is((select count(*) from public.body_checkin_status('11111111-1111-4111-8111-111111111111', '2026-12-01')),
  0::bigint, 'other group: no status');
select is((select count(*) from public.body_measurement_stats('11111111-1111-4111-8111-111111111111')),
  0::bigint, 'other group: no figures');
select is((select count(*) from public.body_measurement_history('11111111-1111-4111-8111-111111111111', 'bauch')),
  0::bigint, 'other group: no history');

-- ---------------------------------------------------------------------------
-- Delete and undo; moving a check-in
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select is((select count(*) from public.body_measurements
            where checkin_id = 'c0000000-0000-4000-8000-000000000001'), 2::bigint,
  'others could not delete my check-in');
delete from public.body_checkins where id = 'c0000000-0000-4000-8000-000000000003';
select is((select count(*) from public.body_measurements
            where checkin_id = 'c0000000-0000-4000-8000-000000000003'), 0::bigint,
  'deleting a check-in removes its values');
select is(
  public.save_body_checkin('2026-12-27', '{"bauch": 88}', 'c0000000-0000-4000-8000-000000000003'),
  'c0000000-0000-4000-8000-000000000003'::uuid, 'undo: saving it again brings back the same id');
select throws_ok(
  $$select public.save_body_checkin('2026-10-01', '{"bauch": 88}', 'c0000000-0000-4000-8000-000000000003')$$,
  '23505', null, 'a check-in cannot move onto a day that has one');

select * from finish();
rollback;
