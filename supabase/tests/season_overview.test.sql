-- Season overview (8c-2): season_overview and season_progress_weeks with concrete numbers.
-- Season "Winter" of group A from Monday 30.11.2026 to Sunday 21.02.2027 (83 days), rules:
-- weigh weekly, a Zwischenstand every 2 weeks. Evaluated on Wednesday 23.12.2026 (week 4).
--   a1: trainings goal 3 per week (weeks: 3 · paused · 2 · running), weight goal 85 → 80 kg
--       (weighed 01.12. 85, 16.12. 84, 22.12. 82.5), two daily season habits (100 % and
--       50 %), a pause 07.–13.12., a check-in 01.12.
--   a2: trainings goal 2 per week (weeks: 2 · 2 · 0 · running), no level goal, no habits,
--       weighed 02.12. only, a skipped check-in 03.12. and one on 21.12.
--   b:  member of group B only.
-- Dates are fixed: the functions take the day as a parameter.

begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

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
-- Finished trainings of a person on the first p_count days from p_monday.
create function tests.week(p_user uuid, p_monday date, p_count integer) returns void
language sql as $$
  insert into public.workouts (user_id, training_type_id, status, started_at, ended_at)
  select p_user,
         (select id from public.training_types where name = 'Studio' and owner_id is null),
         'finished',
         (p_monday + n + time '10:00') at time zone 'Europe/Berlin',
         (p_monday + n + time '11:00') at time zone 'Europe/Berlin'
    from generate_series(0, p_count - 1) n
$$;
grant execute on all functions in schema tests to authenticated;

-- The season, written directly (the setup rules are tested elsewhere).
insert into public.seasons (id, group_id, name, setup_opens_on, starts_on, ends_on,
                            weigh_weekly, checkin_every_weeks)
values ('5e000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'Winter', '2026-11-23', '2026-11-30', '2027-02-21', true, 2);
insert into public.season_members (season_id, user_id, starts_on, ready_at, added_at) values
  ('5e000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   '2026-11-30', now(), '2026-11-23 10:00+01'),
  ('5e000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222',
   '2026-11-30', now(), '2026-11-23 10:01+01');

insert into public.goals (id, user_id, metric, starts_on, ends_on, start_value, visibility, created_at) values
  ('90000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'trainings_per_week', '2026-11-30', '2027-02-21', null, 'shared', '2026-11-23 10:00+01'),
  ('90000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   'body_weight', '2026-11-30', '2027-02-21', 85, 'shared', '2026-11-23 09:00+01'),
  ('90000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222',
   'trainings_per_week', '2026-11-30', '2027-02-21', null, 'shared', '2026-11-23 10:00+01');
insert into public.goal_versions (goal_id, valid_from, min_value, target_value) values
  ('90000000-0000-4000-8000-000000000001', '2026-11-30', null, 3),
  ('90000000-0000-4000-8000-000000000002', '2026-11-30', null, 80),
  ('90000000-0000-4000-8000-000000000003', '2026-11-30', null, 2);
insert into public.season_goals (season_id, user_id, goal_id) values
  ('5e000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   '90000000-0000-4000-8000-000000000001'),
  ('5e000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   '90000000-0000-4000-8000-000000000002'),
  ('5e000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222',
   '90000000-0000-4000-8000-000000000003');

-- a1: a pause over the whole second week.
insert into public.habit_pauses (user_id, from_date, to_date)
values ('11111111-1111-4111-8111-111111111111', '2026-12-07', '2026-12-13');

-- Trainings.
select tests.week('11111111-1111-4111-8111-111111111111', '2026-11-30', 3);
select tests.week('11111111-1111-4111-8111-111111111111', '2026-12-14', 2);
select tests.week('22222222-2222-4222-8222-222222222222', '2026-11-30', 2);
select tests.week('22222222-2222-4222-8222-222222222222', '2026-12-07', 2);

-- Weigh-ins (a1's trend: 85 on 01.12., 84 on 16.12., (84 + 82.5) / 2 = 83.25 on 22.12.).
insert into public.weigh_ins (user_id, measured_on, weight_kg) values
  ('11111111-1111-4111-8111-111111111111', '2026-12-01', 85),
  ('11111111-1111-4111-8111-111111111111', '2026-12-16', 84),
  ('11111111-1111-4111-8111-111111111111', '2026-12-22', 82.5),
  ('22222222-2222-4222-8222-222222222222', '2026-12-02', 70);

-- Check-ins.
insert into public.body_checkins (user_id, on_date, skipped) values
  ('11111111-1111-4111-8111-111111111111', '2026-12-01', false),
  ('22222222-2222-4222-8222-222222222222', '2026-12-03', true),
  ('22222222-2222-4222-8222-222222222222', '2026-12-21', false);

-- a1's season habits, daily: 16 free days counted (30.11.–06.12. and 14.–22.12.; today
-- open). H1 met on all of them (100 %), H2 on 30.11.–06.12. and 14.12. (8 of 16: 50 %).
insert into public.habits (id, user_id) values
  ('ab000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111'),
  ('ab000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111');
insert into public.habit_versions (habit_id, valid_from, name, input_type, frequency, time_of_day, source) values
  ('ab000000-0000-4000-8000-000000000001', '2026-11-01', 'Schlaf', 'yes_no', 'daily', 'evening', 'manual'),
  ('ab000000-0000-4000-8000-000000000002', '2026-11-01', 'Kein Alkohol', 'yes_no', 'daily', 'evening', 'manual');
insert into public.habit_entries (habit_id, on_date, value)
select 'ab000000-0000-4000-8000-000000000001', d::date, '{"done":true}'
  from generate_series('2026-11-30'::date, '2026-12-22'::date, interval '1 day') d
 where d::date not between '2026-12-07' and '2026-12-13';
insert into public.habit_entries (habit_id, on_date, value)
select 'ab000000-0000-4000-8000-000000000002', d::date,
       case when d::date <= '2026-12-14' then '{"done":true}' else '{"done":false}' end::jsonb
  from generate_series('2026-11-30'::date, '2026-12-22'::date, interval '1 day') d
 where d::date not between '2026-12-07' and '2026-12-13';
insert into public.season_habits (season_id, user_id, habit_id) values
  ('5e000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'ab000000-0000-4000-8000-000000000001'),
  ('5e000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'ab000000-0000-4000-8000-000000000002');

set local role authenticated;

-- ---------------------------------------------------------------------------
-- season_overview
-- ---------------------------------------------------------------------------
select tests.login('22222222-2222-4222-8222-222222222222');

select results_eq(
  $$select user_id, starts_on from public.season_overview(
      '5e000000-0000-4000-8000-000000000001', '2026-12-23', 'Europe/Berlin')$$,
  $$values ('11111111-1111-4111-8111-111111111111'::uuid, '2026-11-30'::date),
           ('22222222-2222-4222-8222-222222222222'::uuid, '2026-11-30'::date)$$,
  'a row per participant, in the order they were added – also one without a level goal');

select results_eq(
  $$select training_weeks, training_weeks_met from public.season_overview(
      '5e000000-0000-4000-8000-000000000001', '2026-12-23', 'Europe/Berlin')$$,
  $$values (2, 1), (3, 2)$$,
  'trainings goal: a1 met the weekly target in 1 of 2 weeks (the paused week left out, the running one not yet), a2 in 2 of 3');

select is(
  (select goals from public.season_overview(
      '5e000000-0000-4000-8000-000000000001', '2026-12-23', 'Europe/Berlin')
    where user_id = '11111111-1111-4111-8111-111111111111'),
  '[{"goal_id": "90000000-0000-4000-8000-000000000001", "metric": "trainings_per_week", "status": "not_reached", "on_track": false},
    {"goal_id": "90000000-0000-4000-8000-000000000002", "metric": "body_weight", "status": "not_reached", "on_track": true}]'::jsonb,
  'the goals in the metrics'' order with status and on-track (5 of 6 trainings: behind; 83.25 kg beyond the line''s 83.61: on track)');

select is(
  (select goals from public.season_overview(
      '5e000000-0000-4000-8000-000000000001', '2026-12-23', 'Europe/Berlin')
    where user_id = '22222222-2222-4222-8222-222222222222'),
  '[{"goal_id": "90000000-0000-4000-8000-000000000003", "metric": "trainings_per_week", "status": "not_reached", "on_track": false}]'::jsonb,
  'a2: only the trainings goal (4 of 6 trainings: behind)');

select results_eq(
  $$select habit_count, habit_quota_pct from public.season_overview(
      '5e000000-0000-4000-8000-000000000001', '2026-12-23', 'Europe/Berlin')$$,
  $$values (2, 75.0::numeric), (0, null::numeric)$$,
  'habit quota: the mean of the season habits (100 % and 50 %: 75 %); none without habits');

select results_eq(
  $$select weigh_weeks_done, weigh_weeks_due from public.season_overview(
      '5e000000-0000-4000-8000-000000000001', '2026-12-23', 'Europe/Berlin')$$,
  $$values (3, 3), (1, 3)$$,
  'weighed: a1 3 of 3 (paused week left out, the running week counts once weighed), a2 1 of 3 (running week not yet)');

select results_eq(
  $$select checkins_done, checkins_due from public.season_overview(
      '5e000000-0000-4000-8000-000000000001', '2026-12-23', 'Europe/Berlin')$$,
  $$values (1, 1), (1, 2)$$,
  'Zwischenstand: a1 1 of 1 (second section still open), a2 1 of 2 (the skipped one does not count, the open section once done)');

select results_eq(
  $$select weigh_weeks_done, weigh_weeks_due, checkins_done, checkins_due
      from public.season_overview('5e000000-0000-4000-8000-000000000001', '2026-11-29', 'Europe/Berlin')$$,
  $$values (0, 0, 0, 0), (0, 0, 0, 0)$$,
  'before the start nothing is due');

-- Without the rules: null.
reset role;
update public.seasons set weigh_weekly = false, checkin_every_weeks = null
 where id = '5e000000-0000-4000-8000-000000000001';
set local role authenticated;
select tests.login('22222222-2222-4222-8222-222222222222');
select results_eq(
  $$select weigh_weeks_done, weigh_weeks_due, checkins_done, checkins_due
      from public.season_overview('5e000000-0000-4000-8000-000000000001', '2026-12-23', 'Europe/Berlin')$$,
  $$values (null::integer, null::integer, null::integer, null::integer),
           (null::integer, null::integer, null::integer, null::integer)$$,
  'rules the season does not have stay null');

-- ---------------------------------------------------------------------------
-- season_progress_weeks
-- ---------------------------------------------------------------------------
select results_eq(
  $$select user_id, on_date, goal_progress_pct from public.season_progress_weeks(
      '5e000000-0000-4000-8000-000000000001', '2026-12-23', 'Europe/Berlin')$$,
  $$values ('11111111-1111-4111-8111-111111111111'::uuid, '2026-11-30'::date, 0.0::numeric),
           ('11111111-1111-4111-8111-111111111111'::uuid, '2026-12-06'::date, 0.0::numeric),
           ('11111111-1111-4111-8111-111111111111'::uuid, '2026-12-13'::date, 0.0::numeric),
           ('11111111-1111-4111-8111-111111111111'::uuid, '2026-12-20'::date, 20.0::numeric),
           ('11111111-1111-4111-8111-111111111111'::uuid, '2026-12-23'::date, 35.0::numeric)$$,
  'progress per week end and today: 85 → 84 → 83.25 kg of 85 → 80 is 0, 20, 35 %; a2 without a level goal has no rows');

-- A second level goal averages in; beyond the target is clamped to 100 %.
reset role;
insert into public.goals (id, user_id, metric, measurement_kind, starts_on, ends_on, start_value, visibility)
values ('90000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111',
        'body_measurement', 'bauch', '2026-11-30', '2027-02-21', 100, 'shared');
insert into public.goal_versions (goal_id, valid_from, min_value, target_value)
values ('90000000-0000-4000-8000-000000000004', '2026-11-30', null, 96);
insert into public.season_goals (season_id, user_id, goal_id)
values ('5e000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
        '90000000-0000-4000-8000-000000000004');
insert into public.body_measurements (checkin_id, kind, value)
select c.id, 'bauch', 90 from public.body_checkins c
 where c.user_id = '11111111-1111-4111-8111-111111111111' and c.on_date = '2026-12-01';
set local role authenticated;
select tests.login('22222222-2222-4222-8222-222222222222');
select results_eq(
  $$select on_date, goal_progress_pct from public.season_progress_weeks(
      '5e000000-0000-4000-8000-000000000001', '2026-12-23', 'Europe/Berlin')$$,
  $$values ('2026-11-30'::date, 0.0::numeric), ('2026-12-06'::date, 50.0::numeric),
           ('2026-12-13'::date, 50.0::numeric), ('2026-12-20'::date, 60.0::numeric),
           ('2026-12-23'::date, 67.5::numeric)$$,
  'the mean over the level goals, each clamped to 0 … 100 % (the measurement is past its target: 100 %)');

select ok(
  not exists (select 1 from public.season_progress_weeks(
      '5e000000-0000-4000-8000-000000000001', '2026-11-29', 'Europe/Berlin')),
  'before the start there is no point');

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------
select tests.login('55555555-5555-4555-8555-555555555555');
select is(
  (select count(*)::integer from public.season_overview(
      '5e000000-0000-4000-8000-000000000001', '2026-12-23', 'Europe/Berlin')),
  0, 'a member of group B gets nothing of group A''s season overview');
select is(
  (select count(*)::integer from public.season_progress_weeks(
      '5e000000-0000-4000-8000-000000000001', '2026-12-23', 'Europe/Berlin')),
  0, 'nor of its progress');

reset role;
select ok(
  not has_function_privilege('anon', 'public.season_overview(uuid, date, text)', 'execute')
  and not has_function_privilege('anon', 'public.season_progress_weeks(uuid, date, text)', 'execute'),
  'anon cannot call them');
select ok(
  not has_function_privilege('authenticated', 'private.season_span_free(uuid, date, date)', 'execute'),
  'the helper is internal');

select * from finish();
rollback;
