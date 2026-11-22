-- Habits (6a): rules per input type, versions (old days keep their rule), sport from
-- trainings per week, pauses (daily: not due; weekly: target shrinks), archive, and that
-- habits are private.
--   a1 owns the habits · b is someone else

begin;
create extension if not exists pgtap with schema extensions;

select plan(30);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'a1@test.local'),
  ('33333333-3333-4333-8333-333333333333', 'b@test.local');
insert into public.profiles (id, display_name, color) values
  ('11111111-1111-4111-8111-111111111111', 'A1', 'person-1'),
  ('33333333-3333-4333-8333-333333333333', 'B', 'person-3');

create schema tests;
grant usage on schema tests to authenticated;
create function tests.template(p_key text) returns uuid language sql stable as $$
  select id from public.habit_templates where key = p_key
$$;
-- state of a habit (by name) on a day, as of 10 December
create function tests.state(p_name text, p_day date) returns text language sql stable as $$
  select state from public.habit_days('11111111-1111-4111-8111-111111111111', p_day, p_day, '2026-12-10')
   where name = p_name
$$;
create function tests.habit(p_name text) returns uuid language sql stable as $$
  select h.id from public.habits h join public.habit_versions v on v.habit_id = h.id
   where v.name = p_name limit 1
$$;
grant execute on all functions in schema tests to authenticated;

set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

-- Sleep from the template, from Monday 30 November: ≥ 7 h and in bed before 23:15
select lives_ok(
  $$select public.save_habit(null, tests.template('sleep'), '2026-11-30', '{}')$$,
  'a habit from a template');
select public.set_habit_entry(tests.habit('Schlaf'), '2026-12-01', '{"start":"23:00","end":"07:00"}');
select is(tests.state('Schlaf', '2026-12-01'), 'done', 'in bed 23:00, 8 h: done');
select public.set_habit_entry(tests.habit('Schlaf'), '2026-12-02', '{"start":"23:40","end":"07:30"}');
select is(tests.state('Schlaf', '2026-12-02'), 'missed', 'in bed 23:40: too late');
select public.set_habit_entry(tests.habit('Schlaf'), '2026-12-04', '{"start":"00:20","end":"08:00"}');

-- From 3 December: before midnight is enough
select public.save_habit(tests.habit('Schlaf'), null, '2026-12-03',
  '{"rule":[{"field":"duration","op":"min","value":420},{"field":"start","op":"before","value":"00:00"}]}');
select public.set_habit_entry(tests.habit('Schlaf'), '2026-12-03', '{"start":"23:40","end":"07:30"}');
select is(tests.state('Schlaf', '2026-12-03'), 'done', 'the new rule from its day on');
select is(tests.state('Schlaf', '2026-12-02'), 'missed', 'older days keep the old rule');
select is(tests.state('Schlaf', '2026-12-04'), 'missed', 'after midnight is still late');
select is(tests.state('Schlaf', '2026-12-05'), 'missed', 'a past day without entry is missed');
select is(tests.state('Schlaf', '2026-12-10'), 'open', 'today without entry is open');
select public.set_habit_entry(tests.habit('Schlaf'), '2026-12-10', '{"start":"01:00","end":"05:00"}');
select is(tests.state('Schlaf', '2026-12-10'), 'missed', 'an answer that misses is missed, also today');
select throws_ok(
  $$select public.set_habit_entry(tests.habit('Schlaf'), '2026-12-05', '{"minutes":30}')$$,
  'P0001', 'invalid_value', 'a value must fit the input type');

-- Duration with a maximum, choice, checklist
select public.save_habit(null, tests.template('screen_time'), '2026-11-30', '{}');
select public.set_habit_entry(tests.habit('Screen-Time'), '2026-12-01', '{"minutes":90}');
select public.set_habit_entry(tests.habit('Screen-Time'), '2026-12-02', '{"minutes":150}');
select results_eq(
  $$select state from public.habit_days('11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-02', '2026-12-10')
     where name = 'Screen-Time' order by on_date$$,
  $$values ('done'::text), ('missed'::text)$$,
  'at most 2 h: 1:30 done, 2:30 missed');
select public.save_habit(null, tests.template('nutrition'), '2026-11-30', '{}');
select public.set_habit_entry(tests.habit('Ernährung'), '2026-12-01', '{"choice":"partly"}');
select is(tests.state('Ernährung', '2026-12-01'), 'partial', '"teilweise" is partly met');
select public.save_habit(null, tests.template('supplements'), '2026-11-30', '{}');
select public.set_habit_entry(tests.habit('Supplements'), '2026-12-01', '{"checked":["creatine"]}');
select public.set_habit_entry(tests.habit('Supplements'), '2026-12-02', '{"checked":["creatine","vitamin_d"]}');
select results_eq(
  $$select state from public.habit_days('11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-02', '2026-12-10')
     where name = 'Supplements' order by on_date$$,
  $$values ('partial'::text), ('done'::text)$$,
  'a checklist is met when everything is ticked');

-- Only on some weekdays (Mon, Wed)
select public.save_habit(null, null, '2026-11-30',
  '{"name":"Dehnen","input_type":"yes_no","frequency":"weekdays","weekdays":[1,3],"time_of_day":"evening","source":"manual"}');
select is(tests.state('Dehnen', '2026-12-01'), null, 'not due on a Tuesday');
select is(tests.state('Dehnen', '2026-12-02'), 'missed', 'due on a Wednesday');

-- Sport from trainings, 4× a week
select public.save_habit(null, tests.template('sport'), '2026-11-30', '{}');
select throws_ok(
  $$select public.set_habit_entry(tests.habit('Sport'), '2026-12-01', '{"done":true}')$$,
  'P0001', 'habit_from_trainings', 'sport is never entered by hand');
reset role;
insert into public.workouts (user_id, training_type_id, status, started_at, ended_at)
select '11111111-1111-4111-8111-111111111111',
       (select id from public.training_types where name = 'Studio' and owner_id is null),
       'finished', d + time '17:00', d + time '18:00'
  from unnest(array['2026-11-30', '2026-12-02', '2026-12-04']::date[]) d;
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select results_eq(
  $$select done_days, target, state from public.habit_weeks(
      '11111111-1111-4111-8111-111111111111', '2026-11-30', '2026-11-30', '2026-12-10')
     where habit_id = tests.habit('Sport')$$,
  $$values (3, 4, 'missed'::text)$$,
  'three trainings in a 4× week: missed');

-- Ill from Monday 7 to Wednesday 9 December
insert into public.habit_pauses (from_date, to_date, note) values ('2026-12-07', '2026-12-09', 'krank');
select is(tests.state('Schlaf', '2026-12-08'), 'paused', 'a pause day counts neither way');
select results_eq(
  $$select target, state from public.habit_weeks(
      '11111111-1111-4111-8111-111111111111', '2026-12-07', '2026-12-07', '2026-12-10')
     where habit_id = tests.habit('Sport')$$,
  $$values (3, 'open'::text)$$,
  'the week target shrinks with the pause (4 × 4/7, rounded up)');
insert into public.habit_pauses (from_date, to_date) values ('2026-12-14', '2026-12-20');
select results_eq(
  $$select state from public.habit_weeks(
      '11111111-1111-4111-8111-111111111111', '2026-12-14', '2026-12-14', '2026-12-10')
     where habit_id = tests.habit('Sport')$$,
  $$values ('paused'::text)$$,
  'a week all pause does not count');

-- Archived: no longer asked, history stays
select public.archive_habit(tests.habit('Dehnen'), true);
select is((select count(*) from public.habit_days('11111111-1111-4111-8111-111111111111',
           current_date + 1, current_date + 1) where name = 'Dehnen'), 0::bigint,
  'an archived habit is no longer asked');
reset role;
update public.habits set archived_at = '2026-12-05 20:00+00' where id = tests.habit('Dehnen');
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select is(tests.state('Dehnen', '2026-12-02'), 'missed', 'its past stays');

-- Figures (as of 10 December)
select public.set_habit_entry(tests.habit('Supplements'), '2026-12-03', '{"checked":["creatine","vitamin_d"]}');
select is(
  (select quota from public.habit_stats('11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-03', '2026-12-10')
    where habit_id = tests.habit('Schlaf')),
  0.667, 'quota: met days out of the days counted');
select is(
  (select quota from public.habit_stats('11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-02', '2026-12-10')
    where habit_id = tests.habit('Supplements')),
  0.750, 'partly met counts partly');
select is(
  (select best_streak from public.habit_stats('11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-10', '2026-12-10')
    where habit_id = tests.habit('Supplements')),
  2, 'the longest run of met days');
select results_eq(
  $$select unit, counted, met from public.habit_stats('11111111-1111-4111-8111-111111111111', '2026-11-30', '2026-12-13', '2026-12-10')
     where habit_id = tests.habit('Sport')$$,
  $$values ('weeks'::text, 1, 0)$$,
  'weekly habits count weeks that ended (not the running one)');

-- Private
set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select is((select count(*) from public.habits), 0::bigint, 'nobody else sees my habits');
select is((select count(*) from public.habit_days('11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-07')),
  0::bigint, 'nor how they went');
select is((select count(*) from public.habit_stats('11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-07')),
  0::bigint, 'nor their figures');
select throws_ok(
  $$select public.set_habit_entry(tests.habit('Schlaf'), '2026-12-06', '{"start":"23:00","end":"07:00"}')$$,
  '42501', 'habit_not_found', 'nor writes into them');

select * from finish();
rollback;
