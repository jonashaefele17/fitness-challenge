-- Habit quota per week (8c-3): group_habit_weeks (shared habits, comparison) and
-- season_habit_weeks (season habits, seasons) with concrete numbers. Evaluated on
-- Wednesday 09.12.2026: the week of 30.11. is over, the week of 07.12. runs.
--   a1 (group A): a pause 06.–07.12.
--     "Ernährung" – daily choice, shared: week 1 held · partly · not · held · held · nothing
--       (missed) · paused = 3.5 of 6 (58.3 %); week 2 paused · held · today open = 100 %.
--     "Sport" – weekly, 2 times, shared: done twice in week 1 (100 %); once so far in the
--       running week (open, does not count yet).
--     "Geheim" – daily, private, never answered (0 % on every day that counts).
--   a2 (group A): "Wasser" – daily, shared, done every day of week 1 (100 %), none in
--     week 2 (08.12. missed: 0 %); "Lesen" – daily, private, season habit; starts the
--     season on 07.12.: done 05.12. (before), done 07.12., not done 08.12.
--   b (group B only): a shared habit of their own.
-- Season "Winter" of group A from Monday 30.11.2026 to Sunday 21.02.2027: a1 from 30.11.
-- with "Ernährung" and "Geheim", a2 from 07.12. with "Lesen".

begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'a1@test.local'),
  ('22222222-2222-4222-8222-222222222222', 'a2@test.local'),
  ('55555555-5555-4555-8555-555555555555', 'b@test.local');
insert into public.profiles (id, display_name, color) values
  ('11111111-1111-4111-8111-111111111111', 'A1', 'person-1'),
  ('22222222-2222-4222-8222-222222222222', 'A2', 'person-2'),
  ('55555555-5555-4555-8555-555555555555', 'B', 'person-5');
insert into public.groups (id, name) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'B');
insert into public.group_members (group_id, user_id, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'admin'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'member'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '55555555-5555-4555-8555-555555555555', 'admin');

create schema tests;
grant usage on schema tests to authenticated;
create function tests.login(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;
grant execute on all functions in schema tests to authenticated;

insert into public.habit_pauses (user_id, from_date, to_date)
values ('11111111-1111-4111-8111-111111111111', '2026-12-06', '2026-12-07');

insert into public.habits (id, user_id, share_level) values
  ('ab000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'done'),
  ('ab000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'values'),
  ('ab000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'private'),
  ('ab000000-0000-4000-8000-000000000004', '22222222-2222-4222-8222-222222222222', 'done'),
  ('ab000000-0000-4000-8000-000000000005', '22222222-2222-4222-8222-222222222222', 'private'),
  ('ab000000-0000-4000-8000-000000000006', '55555555-5555-4555-8555-555555555555', 'done');
insert into public.habit_versions (habit_id, valid_from, name, input_type, frequency,
                                   times_per_week, time_of_day, source, options) values
  ('ab000000-0000-4000-8000-000000000001', '2026-11-01', 'Ernährung', 'choice', 'daily', null,
   'evening', 'manual',
   '[{"key":"held","label":"Gehalten","score":1},{"key":"partly","label":"Teilweise","score":0.5},{"key":"not","label":"Nicht gehalten","score":0}]'),
  ('ab000000-0000-4000-8000-000000000002', '2026-11-01', 'Sport', 'yes_no', 'weekly', 2,
   'evening', 'manual', '[]'),
  ('ab000000-0000-4000-8000-000000000003', '2026-11-01', 'Geheim', 'yes_no', 'daily', null,
   'evening', 'manual', '[]'),
  ('ab000000-0000-4000-8000-000000000004', '2026-11-01', 'Wasser', 'yes_no', 'daily', null,
   'evening', 'manual', '[]'),
  ('ab000000-0000-4000-8000-000000000005', '2026-11-01', 'Lesen', 'yes_no', 'daily', null,
   'evening', 'manual', '[]'),
  ('ab000000-0000-4000-8000-000000000006', '2026-11-01', 'Wasser', 'yes_no', 'daily', null,
   'evening', 'manual', '[]');
insert into public.habit_entries (habit_id, on_date, value) values
  ('ab000000-0000-4000-8000-000000000001', '2026-11-30', '{"choice":"held"}'),
  ('ab000000-0000-4000-8000-000000000001', '2026-12-01', '{"choice":"partly"}'),
  ('ab000000-0000-4000-8000-000000000001', '2026-12-02', '{"choice":"not"}'),
  ('ab000000-0000-4000-8000-000000000001', '2026-12-03', '{"choice":"held"}'),
  ('ab000000-0000-4000-8000-000000000001', '2026-12-04', '{"choice":"held"}'),
  ('ab000000-0000-4000-8000-000000000001', '2026-12-08', '{"choice":"held"}'),
  ('ab000000-0000-4000-8000-000000000002', '2026-12-01', '{"done":true}'),
  ('ab000000-0000-4000-8000-000000000002', '2026-12-03', '{"done":true}'),
  ('ab000000-0000-4000-8000-000000000002', '2026-12-08', '{"done":true}'),
  ('ab000000-0000-4000-8000-000000000005', '2026-12-05', '{"done":true}'),
  ('ab000000-0000-4000-8000-000000000005', '2026-12-07', '{"done":true}'),
  ('ab000000-0000-4000-8000-000000000005', '2026-12-08', '{"done":false}'),
  ('ab000000-0000-4000-8000-000000000006', '2026-11-30', '{"done":true}');
insert into public.habit_entries (habit_id, on_date, value)
select 'ab000000-0000-4000-8000-000000000004', d::date, '{"done":true}'
  from generate_series('2026-11-30'::date, '2026-12-06'::date, interval '1 day') d;

insert into public.seasons (id, group_id, name, setup_opens_on, starts_on, ends_on)
values ('5e000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'Winter', '2026-11-23', '2026-11-30', '2027-02-21');
insert into public.season_members (season_id, user_id, starts_on, ready_at, added_at) values
  ('5e000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   '2026-11-30', now(), '2026-11-23 10:00+01'),
  ('5e000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222',
   '2026-12-07', now(), '2026-12-05 10:00+01');
insert into public.season_habits (season_id, user_id, habit_id) values
  ('5e000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'ab000000-0000-4000-8000-000000000001'),
  ('5e000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'ab000000-0000-4000-8000-000000000003'),
  ('5e000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222',
   'ab000000-0000-4000-8000-000000000005');

set local role authenticated;

-- ---------------------------------------------------------------------------
-- group_habit_weeks
-- ---------------------------------------------------------------------------
select tests.login('22222222-2222-4222-8222-222222222222');

select results_eq(
  $$select week_start, quota_pct, counted from public.group_habit_weeks(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2026-11-30', '2026-12-13', '2026-12-09', 'Europe/Berlin')
     where user_id = '11111111-1111-4111-8111-111111111111'$$,
  $$values ('2026-11-30'::date, 79.2::numeric, 2), ('2026-12-07'::date, 100.0::numeric, 1)$$,
  'a1 seen by a2: week 1 the mean of Ernährung (3.5 of 6: 58.3 %) and Sport (done: 100 %); week 2 only Ernährung (100 %) – the running weekly week and the private habit do not count');

select results_eq(
  $$select week_start, quota_pct, counted from public.group_habit_weeks(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2026-11-30', '2026-12-13', '2026-12-09', 'Europe/Berlin')
     where user_id = '22222222-2222-4222-8222-222222222222'$$,
  $$values ('2026-11-30'::date, 100.0::numeric, 1), ('2026-12-07'::date, 0.0::numeric, 1)$$,
  'a2 (me): only the shared habit, not the private season habit; a missed day counts 0 %');

select results_eq(
  $$select week_start, quota_pct from public.group_habit_weeks(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2026-12-02', '2026-12-13', '2026-12-09', 'Europe/Berlin')
     where user_id = '11111111-1111-4111-8111-111111111111'$$,
  $$values ('2026-11-30'::date, 75.0::numeric), ('2026-12-07'::date, 100.0::numeric)$$,
  'from a Wednesday: only the days in the range count (Ernährung 2 of 4: 50 %), the weekly habit''s week still counts');

select ok(
  not exists (select 1 from public.group_habit_weeks(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2026-11-30', '2026-12-13', '2026-12-09', 'Europe/Berlin')
     where user_id = '55555555-5555-4555-8555-555555555555'),
  'nobody outside the group');

-- An archived shared habit drops out.
reset role;
update public.habits set archived_at = '2026-12-09 10:00+01'
 where id = 'ab000000-0000-4000-8000-000000000002';
set local role authenticated;
select tests.login('22222222-2222-4222-8222-222222222222');
select results_eq(
  $$select week_start, quota_pct, counted from public.group_habit_weeks(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2026-11-30', '2026-12-13', '2026-12-09', 'Europe/Berlin')
     where user_id = '11111111-1111-4111-8111-111111111111'$$,
  $$values ('2026-11-30'::date, 58.3::numeric, 1), ('2026-12-07'::date, 100.0::numeric, 1)$$,
  'an archived habit no longer counts');

select tests.login('55555555-5555-4555-8555-555555555555');
select is(
  (select count(*)::integer from public.group_habit_weeks(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2026-11-30', '2026-12-13', '2026-12-09', 'Europe/Berlin')),
  0, 'a member of group B gets nothing of group A');
select results_eq(
  $$select user_id, week_start, quota_pct from public.group_habit_weeks(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '2026-11-30', '2026-12-13', '2026-12-09', 'Europe/Berlin')$$,
  $$values ('55555555-5555-4555-8555-555555555555'::uuid, '2026-11-30'::date, 14.3::numeric),
           ('55555555-5555-4555-8555-555555555555'::uuid, '2026-12-07'::date, 0.0::numeric)$$,
  'and their own group only themselves (1 of 7, then 0 of 2)');

-- ---------------------------------------------------------------------------
-- season_habit_weeks
-- ---------------------------------------------------------------------------
select tests.login('22222222-2222-4222-8222-222222222222');
select results_eq(
  $$select user_id, week_start, quota_pct, counted from public.season_habit_weeks(
      '5e000000-0000-4000-8000-000000000001', '2026-12-09', 'Europe/Berlin')$$,
  $$values ('11111111-1111-4111-8111-111111111111'::uuid, '2026-11-30'::date, 29.2::numeric, 2),
           ('11111111-1111-4111-8111-111111111111'::uuid, '2026-12-07'::date, 50.0::numeric, 2),
           ('22222222-2222-4222-8222-222222222222'::uuid, '2026-12-07'::date, 50.0::numeric, 1)$$,
  'season habits, private ones too: a1 Ernährung 58.3 % and Geheim 0 % (29.2 %), then 100 % and 0 %; a2 from their start on 07.12. (the day before does not count)');

select ok(
  not exists (select 1 from public.season_habit_weeks(
      '5e000000-0000-4000-8000-000000000001', '2026-11-29', 'Europe/Berlin')),
  'before the start nothing counts');

select tests.login('55555555-5555-4555-8555-555555555555');
select is(
  (select count(*)::integer from public.season_habit_weeks(
      '5e000000-0000-4000-8000-000000000001', '2026-12-09', 'Europe/Berlin')),
  0, 'a member of group B gets nothing of group A''s season');

reset role;
select ok(
  not has_function_privilege('anon', 'public.group_habit_weeks(uuid, date, date, date, text)', 'execute')
  and not has_function_privilege('anon', 'public.season_habit_weeks(uuid, date, text)', 'execute'),
  'anon cannot call them');
select ok(
  not has_function_privilege('authenticated',
    'private.habit_week_quota(uuid, uuid[], date, date, date, text)', 'execute'),
  'the core is internal');

select * from finish();
rollback;
