-- Personal goals (8a): metrics as data, writing through the functions only, each metric's
-- figures with concrete numbers (lower is better, pauses, minimum and target, versions,
-- after the end), history, start suggestions, archive, and who sees what (private by
-- default, shared goals for the group with kg / cm masked, nothing for another group).
--   a1 has the goals · a2 is in the same group (and its admin) · b is in another group
-- Calendar: Monday 30.11.2026, 7.12., 14.12., 21.12. Pauses of a1: 7.–9.12. and 14.–20.12.

begin;
create extension if not exists pgtap with schema extensions;

select plan(49);

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
insert into public.group_members (group_id, user_id, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'member'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'admin'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '33333333-3333-4333-8333-333333333333', 'member');

insert into public.exercises (id, name, measure) values
  ('e0000000-0000-4000-8000-000000000001', 'Test-Bank', 'weight_reps');

create schema tests;
grant usage on schema tests to authenticated;
-- A finished training of a1 at 10:00 Berlin time, optionally with sets of Test-Bank
-- ({kg, reps, warm-up 0/1}).
create function tests.training(p_day date, p_sets numeric[][] default null) returns void
language plpgsql as $$
declare w uuid := gen_random_uuid(); i uuid := gen_random_uuid(); n integer;
begin
  insert into public.workouts (id, user_id, training_type_id, status, started_at, ended_at)
  values (w, '11111111-1111-4111-8111-111111111111',
          (select id from public.training_types where name = 'Studio' and owner_id is null),
          'finished', (p_day + time '10:00') at time zone 'Europe/Berlin',
          (p_day + time '11:00') at time zone 'Europe/Berlin');
  if p_sets is null then
    return;
  end if;
  insert into public.workout_items (id, workout_id, exercise_id, position)
  values (i, w, 'e0000000-0000-4000-8000-000000000001', 0);
  for n in 1 .. array_length(p_sets, 1) loop
    insert into public.workout_sets (item_id, position, weight_kg, reps, is_warmup, completed_at)
    values (i, n - 1, p_sets[n][1], p_sets[n][2]::integer, p_sets[n][3] = 1, now());
  end loop;
end $$;
create function tests.habit(p_name text) returns uuid language sql stable security definer as $$
  select h.id from public.habits h join public.habit_versions v on v.habit_id = h.id
   where v.name = p_name limit 1
$$;
grant execute on all functions in schema tests to authenticated;

-- Trainings: week 1: Mon (twice), Tue, Thu (bench), Sat · week 2: Tue (paused), Thu (bench),
-- Sat · week 3 (all paused): Tue · week 4: Mon. Before: 20.11. (bench).
select tests.training('2026-11-20', array[[100, 5, 0]]);
select tests.training('2026-11-30');
select tests.training('2026-11-30');
select tests.training('2026-12-01');
select tests.training('2026-12-03', array[[100, 5, 0], [105, 3, 0]]);
select tests.training('2026-12-05');
select tests.training('2026-12-08');
select tests.training('2026-12-10', array[[120, 5, 1], [102.5, 5, 0]]);
select tests.training('2026-12-12');
select tests.training('2026-12-15');
select tests.training('2026-12-21');
insert into public.habit_pauses (user_id, from_date, to_date) values
  ('11111111-1111-4111-8111-111111111111', '2026-12-07', '2026-12-09'),
  ('11111111-1111-4111-8111-111111111111', '2026-12-14', '2026-12-20');
-- Weight (main scale): 85 → 84 → 83 → 82
insert into public.weigh_ins (user_id, measured_on, weight_kg) values
  ('11111111-1111-4111-8111-111111111111', '2026-12-01', 85),
  ('11111111-1111-4111-8111-111111111111', '2026-12-05', 84),
  ('11111111-1111-4111-8111-111111111111', '2026-12-10', 83),
  ('11111111-1111-4111-8111-111111111111', '2026-12-16', 82);

set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

-- Bauch: 90 before the goal, 88 within it
select public.save_body_checkin('2026-11-25', '{"bauch": 90}');
select public.save_body_checkin('2026-12-10', '{"bauch": 88}');
-- Kein Alkohol from 1.12.: met on 1, 2, 4, 5, 10, 11, 12 · "Nein" on 3 · nothing on 6 ·
-- 7–9 paused · 13 still open (as of 13.12.)
select public.save_habit(null, (select id from public.habit_templates where key = 'no_alcohol'),
  '2026-12-01', '{}');
select public.set_habit_entry(tests.habit('Kein Alkohol'), d::date, '{"done":true}')
  from unnest(array['2026-12-01', '2026-12-02', '2026-12-04', '2026-12-05', '2026-12-10',
                    '2026-12-11', '2026-12-12']) d;
select public.set_habit_entry(tests.habit('Kein Alkohol'), '2026-12-03', '{"done":false}');

-- ---------------------------------------------------------------------------
-- Metrics and writing
-- ---------------------------------------------------------------------------
select results_eq(
  $$select key, kind, reference, unit from public.goal_metrics order by sort$$,
  $$values ('trainings_per_week'::text, 'rate'::text, null::text, 'per_week'::text),
           ('body_weight', 'level', null, 'kg'),
           ('exercise_best', 'level', 'exercise', null),
           ('habit_rate', 'rate', 'habit', 'percent'),
           ('body_measurement', 'level', 'measurement', null)$$,
  'five metrics as data');
select throws_ok(
  $$insert into public.goal_metrics (key, label, description, kind, sort) values ('x', 'X', 'x', 'rate', 1)$$,
  '42501', null, 'metrics cannot be added by clients');
select throws_ok(
  $$insert into public.goals (metric, starts_on, ends_on, start_value) values ('body_weight', '2026-12-01', '2026-12-31', 85)$$,
  '42501', null, 'goals are not written directly');

select is(
  public.create_goal('90000000-0000-4000-8000-000000000001', 'trainings_per_week',
    '2026-11-30', '2026-12-27', 2.5, 3, 4),
  '90000000-0000-4000-8000-000000000001'::uuid, 'a trainings goal with the client''s id');
select public.create_goal('90000000-0000-4000-8000-000000000002', 'body_weight',
  '2026-12-01', '2026-12-31', 85, 83, 80, 'shared');
select public.create_goal('90000000-0000-4000-8000-000000000003', 'exercise_best',
  '2026-12-01', '2026-12-31', 97.5, 102.5, 110, 'shared',
  p_exercise_id => 'e0000000-0000-4000-8000-000000000001', p_reps => 5);
select public.create_goal('90000000-0000-4000-8000-000000000004', 'habit_rate',
  '2026-12-01', '2026-12-31', null, 75, 90, p_habit_id => tests.habit('Kein Alkohol'));
select public.create_goal('90000000-0000-4000-8000-000000000005', 'body_measurement',
  '2026-12-01', '2026-12-31', 90, null, 85, 'shared', p_measurement_kind => 'bauch');
select results_eq(
  $$select count(*) from public.goals$$, $$values (5::bigint)$$, 'five goals');
select results_eq(
  $$select valid_from, min_value, target_value from public.goal_versions
     where goal_id = '90000000-0000-4000-8000-000000000002'$$,
  $$values ('2026-12-01'::date, 83.00::numeric, 80.00::numeric)$$,
  'the first version starts with the goal');

select throws_ok(
  $$select public.create_goal(null, 'body_weight', '2026-12-01', '2026-12-31', 85, 79, 80)$$,
  '22023', 'min_not_between_start_and_target', 'a minimum beyond the target is rejected');
select throws_ok(
  $$select public.create_goal(null, 'body_weight', '2026-12-01', '2026-12-31', 85, null, 85)$$,
  '22023', 'target_equals_start', 'a level goal needs a target other than the start');
select throws_ok(
  $$select public.create_goal(null, 'body_weight', '2026-12-31', '2026-12-01', 85, null, 80)$$,
  '22023', 'invalid_period', 'the end lies after the start');
select throws_ok(
  $$select public.create_goal(null, 'habit_rate', '2026-12-01', '2026-12-31', null, null, 120,
      p_habit_id => tests.habit('Kein Alkohol'))$$,
  '22023', 'target_too_high', 'a quota is at most 100 %');
select throws_ok(
  $$select public.create_goal(null, 'exercise_best', '2026-12-01', '2026-12-31', 97.5, null, 110,
      p_exercise_id => 'e0000000-0000-4000-8000-000000000001')$$,
  '22023', 'reps_only_for_weight_exercises', 'a weight exercise needs the rep count');
select throws_ok(
  $$select public.create_goal(null, 'body_weight', '2026-12-01', '2026-12-31', 85, null, 80,
      p_measurement_kind => 'bauch')$$,
  '22023', 'reference_does_not_fit_metric', 'a reference must fit the metric');
select throws_ok(
  $$select public.create_goal(null, 'habit_rate', '2026-12-01', '2026-12-31', null, null, 90,
      p_habit_id => gen_random_uuid())$$,
  '42501', 'habit_not_found', 'only my own habits');

-- ---------------------------------------------------------------------------
-- Trainings per week (as of Wednesday 23.12.)
--   week 1: 4 days (Monday counts once) → target 4 reached
--   week 2: 3 days paused → min ⌈3·4/7⌉ = 2, target ⌈4·4/7⌉ = 3; Tue is paused → 2 → min
--   week 3: all paused → left out · week 4: running, 1 so far
--   totals: 6 trainings, min asked 5, target asked 7
-- ---------------------------------------------------------------------------
select results_eq(
  $$select phase, counted, min_met, target_met, current_value, progress_pct, status, on_track,
           week_done, week_min, week_target, min_value, target_value, unit, count_unit
      from public.goal_progress(null, '2026-12-23')
     where id = '90000000-0000-4000-8000-000000000001'$$,
  $$values ('running'::text, 2, 2, 1, 3.0::numeric, 85.7::numeric, 'min_reached'::text, true,
            1, 3, 4, 3.00::numeric, 4.00::numeric, 'per_week'::text, 'weeks'::text)$$,
  'trainings: two judged weeks, average 3, 6 of 7 → minimum reached, on course');
select results_eq(
  $$select on_date, value, min_value, target_value, progress_pct, state
      from public.goal_history('90000000-0000-4000-8000-000000000001', '2026-12-23')$$,
  $$values ('2026-11-30'::date, 4::numeric, 3::numeric, 4::numeric, 100.0::numeric, 'target_reached'::text),
           ('2026-12-07', 2, 2, 3, 66.7, 'min_reached'),
           ('2026-12-14', 0, 0, 0, null, 'paused'),
           ('2026-12-21', 1, 3, 4, 25.0, 'open')$$,
  'trainings history: one point per week, pauses shrink min and target');
select results_eq(
  $$select phase, evaluated_on, counted, current_value, progress_pct, status, on_track, week_done
      from public.goal_progress(null, '2027-01-05')
     where id = '90000000-0000-4000-8000-000000000001'$$,
  $$values ('ended'::text, '2026-12-27'::date, 3, 2.3::numeric, 63.6::numeric, 'below_min'::text,
            false, null::integer)$$,
  'after the end: the last week (1 of min 3) counts, 7 of 8 asked → below the minimum');

-- From 7.12. min 2 / target 3: week 1 keeps its rule (4), week 2 now needs 2 → target
select lives_ok(
  $$select public.update_goal('90000000-0000-4000-8000-000000000001', '2026-11-30',
      '2026-12-27', 2.5, 2, 3, 'private', '2026-12-07')$$,
  'a new version from 7.12.');
select results_eq(
  $$select progress_pct, status, min_value, target_value, target_met
      from public.goal_progress(null, '2026-12-23')
     where id = '90000000-0000-4000-8000-000000000001'$$,
  $$values (100.0::numeric, 'target_reached'::text, 2.00::numeric, 3.00::numeric, 2)$$,
  'each week by the rule valid then: 6 of 4 + 2 → target reached');
select public.update_goal('90000000-0000-4000-8000-000000000001', '2026-11-30',
  '2026-12-27', 2.5, 3, 4, 'private', '2026-12-07');
select results_eq(
  $$select count(*) from public.goal_versions where goal_id = '90000000-0000-4000-8000-000000000001'$$,
  $$values (1::bigint)$$,
  'saving the old values again (undo) removes the version');

-- ---------------------------------------------------------------------------
-- Body weight, lower is better (as of 16.12.): 85 → 80, minimum 83
--   trend 16.12. = (83 + 82) / 2 = 82.5 · progress −2.5 / −5 = 50 % · line on 16.12.:
--   85 − 5 · 15/30 = 82.5 → on course · 82.5 ≤ 83 → minimum reached
-- ---------------------------------------------------------------------------
select results_eq(
  $$select current_value, current_on, progress_pct, expected_value, on_track, status, values_hidden
      from public.goal_progress(null, '2026-12-16')
     where id = '90000000-0000-4000-8000-000000000002'$$,
  $$values (82.50::numeric, '2026-12-16'::date, 50.0::numeric, 82.50::numeric, true,
            'min_reached'::text, false)$$,
  'weight: 7-day trend, progress downwards, on the line, minimum reached');
select results_eq(
  $$select on_date, value, expected_value, progress_pct, state
      from public.goal_history('90000000-0000-4000-8000-000000000002', '2026-12-16')$$,
  $$values ('2026-12-01'::date, 85.00::numeric, 85.00::numeric, 0.0::numeric, 'below_min'::text),
           ('2026-12-05', 84.50, 84.33, 10.0, 'below_min'),
           ('2026-12-10', 83.50, 83.50, 30.0, 'below_min'),
           ('2026-12-16', 82.50, 82.50, 50.0, 'min_reached')$$,
  'weight history: each day weighed with the line');
select results_eq(
  $$select status from public.goal_progress(null, '2026-11-20')
     where id = '90000000-0000-4000-8000-000000000002'$$,
  $$values (null::text)$$,
  'before the start: no value, no status');

-- ---------------------------------------------------------------------------
-- Best value at an exercise (as of 16.12.): kg at 5 reps, 97.5 → 110, minimum 102.5
--   3.12.: 100 × 5 beats 105 × 3 (as in the records) · 10.12.: 102.5 × 5 (the warm-up 120
--   does not count) · 20.11. was before the start · line on 16.12.: 103.75 → behind
-- ---------------------------------------------------------------------------
select results_eq(
  $$select current_value, best_weight_kg, best_reps, current_on, progress_pct, expected_value,
           on_track, status, unit
      from public.goal_progress(null, '2026-12-16')
     where id = '90000000-0000-4000-8000-000000000003'$$,
  $$values (102.50::numeric, 102.50::numeric, 5, '2026-12-10'::date, 40.0::numeric,
            103.75::numeric, false, 'min_reached'::text, 'kg'::text)$$,
  'exercise: best set since the start, behind the line, minimum reached');
select results_eq(
  $$select weight_kg, reps from public.exercise_records('e0000000-0000-4000-8000-000000000001')
     where kind = 'best'$$,
  $$values (102.50::numeric, 5)$$,
  'the same set the records call best');
select results_eq(
  $$select on_date, value, state
      from public.goal_history('90000000-0000-4000-8000-000000000003', '2026-12-16')$$,
  $$values ('2026-12-03'::date, 100.00::numeric, 'below_min'::text),
           ('2026-12-10', 102.50, 'min_reached')$$,
  'exercise history: each training day''s best set');

-- ---------------------------------------------------------------------------
-- Habit quota (as of 13.12.): 9 days counted (pauses and today left out), 7 met → 77.8 %
--   target 90, minimum 75 → minimum reached, on course; the same quota as habit_stats
-- ---------------------------------------------------------------------------
select results_eq(
  $$select counted, target_met, count_unit, current_value, progress_pct, status, on_track,
           reference_label
      from public.goal_progress(null, '2026-12-13')
     where id = '90000000-0000-4000-8000-000000000004'$$,
  $$values (9, 7, 'days'::text, 77.8::numeric, 86.4::numeric, 'min_reached'::text, true,
            'Kein Alkohol'::text)$$,
  'habit: quota since the start, pause-aware');
select results_eq(
  $$select round(quota * 100, 1) from public.habit_stats(
      '11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-13', '2026-12-13')
     where habit_id = tests.habit('Kein Alkohol')$$,
  $$values (77.8::numeric)$$,
  'habit_stats agrees');
select results_eq(
  $$select on_date, value, min_value, target_value, progress_pct, state
      from public.goal_history('90000000-0000-4000-8000-000000000004', '2026-12-13')$$,
  $$values ('2026-11-30'::date, 66.7::numeric, 75.00::numeric, 90.00::numeric, 74.1::numeric, 'below_min'::text),
           ('2026-12-07', 100.0, 75.00, 90.00, 111.1, 'target_reached')$$,
  'habit history: the quota per week');

-- ---------------------------------------------------------------------------
-- Body measurement without a minimum (as of 16.12.): Bauch 90 → 85; 88 on 10.12.
--   (the 90 from 25.11. was before the start) · 40 % · line 87.5 → behind · two steps
-- ---------------------------------------------------------------------------
select results_eq(
  $$select current_value, current_on, progress_pct, expected_value, on_track, status, unit,
           reference_label
      from public.goal_progress(null, '2026-12-16')
     where id = '90000000-0000-4000-8000-000000000005'$$,
  $$values (88.0::numeric, '2026-12-10'::date, 40.0::numeric, 87.50::numeric, false,
            'not_reached'::text, 'cm'::text, 'Bauch'::text)$$,
  'measurement: latest check-in since the start, two-step status without a minimum');

-- ---------------------------------------------------------------------------
-- Start suggestions and references
-- ---------------------------------------------------------------------------
select results_eq(
  $$select value, on_date from public.goal_start_suggestion('body_weight', '2026-12-16')$$,
  $$values (82.50::numeric, '2026-12-16'::date)$$,
  'weight: the current 7-day trend');
select results_eq(
  $$select value, reps, best_weight_kg, best_reps from public.goal_start_suggestion(
      'exercise_best', '2026-12-16', p_exercise_id => 'e0000000-0000-4000-8000-000000000001')$$,
  $$values (102.50::numeric, 5, 102.50::numeric, 5)$$,
  'exercise: the best set of the last 4 weeks, at its reps');
select results_eq(
  $$select value from public.goal_start_suggestion('body_measurement', '2026-12-16',
      p_measurement_kind => 'bauch')$$,
  $$values (88.0::numeric)$$,
  'measurement: the latest check-in');
select results_eq(
  $$select value from public.goal_start_suggestion('trainings_per_week', '2026-12-23')$$,
  $$values (2.0::numeric)$$,
  'trainings: last 4 finished weeks 0, 4, 2 (the paused week left out)');
select results_eq(
  $$select value from public.goal_start_suggestion('habit_rate', '2026-12-13',
      p_habit_id => tests.habit('Kein Alkohol'))$$,
  $$values (77.8::numeric)$$,
  'habit: the quota of the last 4 weeks');
select results_eq(
  $$select exercise_id, device_id, label, unit, needs_reps
      from public.goal_reference_options('exercise_best')$$,
  $$values ('e0000000-0000-4000-8000-000000000001'::uuid, null::uuid, 'Test-Bank'::text, 'kg'::text, true)$$,
  'exercises I have done');
select results_eq(
  $$select label from public.goal_reference_options('habit_rate')$$,
  $$values ('Kein Alkohol'::text)$$,
  'my habits');
select results_eq(
  $$select count(*), count(*) filter (where measurement_kind = 'bauch' and last_used_on = '2026-12-10')
      from public.goal_reference_options('body_measurement')$$,
  $$values (6::bigint, 1::bigint)$$,
  'the measurement kinds, with when I last measured');

-- ---------------------------------------------------------------------------
-- Archive
-- ---------------------------------------------------------------------------
select public.archive_goal('90000000-0000-4000-8000-000000000005', true);
select results_eq(
  $$select (select count(*) from public.goal_progress(null, '2026-12-16')),
           (select count(*) from public.goal_progress(null, '2026-12-16', p_include_archived => true))$$,
  $$values (4::bigint, 5::bigint)$$,
  'an archived goal leaves the list and stays');

-- ---------------------------------------------------------------------------
-- Who sees what
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';
select results_eq(
  $$select (select count(*) from public.goals), (select count(*) from public.goal_versions)$$,
  $$values (0::bigint, 0::bigint)$$,
  'the tables are the owner''s only, also for the group admin');
select results_eq(
  $$select id from public.goal_progress('11111111-1111-4111-8111-111111111111', '2026-12-16')$$,
  $$values ('90000000-0000-4000-8000-000000000002'::uuid), ('90000000-0000-4000-8000-000000000003'::uuid)$$,
  'the group sees the shared goals only (private and archived ones not, also not the admin)');
select results_eq(
  $$select count(*) from public.goal_history('90000000-0000-4000-8000-000000000001', '2026-12-23')$$,
  $$values (0::bigint)$$,
  'no history of a private goal');
select results_eq(
  $$select values_hidden, start_value, target_value, current_value, expected_value,
           progress_pct, status, on_track
      from public.goal_progress('11111111-1111-4111-8111-111111111111', '2026-12-16')
     where id = '90000000-0000-4000-8000-000000000002'$$,
  $$values (true, null::numeric, null::numeric, null::numeric, null::numeric, 50.0::numeric,
            'min_reached'::text, true)$$,
  'weight not shared in kg: progress and status, no kg');
select results_eq(
  $$select count(*) filter (where value is not null or target_value is not null
                              or expected_value is not null),
           count(*) filter (where progress_pct is not null)
      from public.goal_history('90000000-0000-4000-8000-000000000002', '2026-12-16')$$,
  $$values (0::bigint, 4::bigint)$$,
  'and its history in % only');
select results_eq(
  $$select current_value, best_weight_kg from public.goal_progress('11111111-1111-4111-8111-111111111111', '2026-12-16')
     where id = '90000000-0000-4000-8000-000000000003'$$,
  $$values (102.50::numeric, 102.50::numeric)$$,
  'a shared exercise goal with its values');
select throws_ok(
  $$select public.archive_goal('90000000-0000-4000-8000-000000000002', true)$$,
  '42501', 'goal_not_found', 'others cannot archive my goal');
select throws_ok(
  $$select public.update_goal('90000000-0000-4000-8000-000000000002', '2026-12-01', '2026-12-31', 85, null, 70, 'shared')$$,
  '42501', 'goal_not_found', 'or change it');

set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
insert into public.body_settings (weight_share) values ('kg');
select public.archive_goal('90000000-0000-4000-8000-000000000005', false);

set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';
select results_eq(
  $$select values_hidden, start_value, current_value from public.goal_progress('11111111-1111-4111-8111-111111111111', '2026-12-16')
     where id = '90000000-0000-4000-8000-000000000002'$$,
  $$values (false, 85.00::numeric, 82.50::numeric)$$,
  'weight shared in kg: kg too');
select results_eq(
  $$select values_hidden, start_value, current_value, progress_pct from public.goal_progress('11111111-1111-4111-8111-111111111111', '2026-12-16')
     where id = '90000000-0000-4000-8000-000000000005'$$,
  $$values (true, null::numeric, null::numeric, 40.0::numeric)$$,
  'a shared measurement goal (brought back): progress only, never cm');

set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select results_eq(
  $$select (select count(*) from public.goal_progress('11111111-1111-4111-8111-111111111111', '2026-12-16')),
           (select count(*) from public.goal_history('90000000-0000-4000-8000-000000000002', '2026-12-16'))$$,
  $$values (0::bigint, 0::bigint)$$,
  'another group sees nothing, not even shared goals');

select * from finish();
rollback;
