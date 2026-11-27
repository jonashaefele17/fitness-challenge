-- Season habits (8b follow-up): linking only for participants and own habits; while the
-- season runs and the participant is locked the rule is fixed (change and archive refused,
-- sharing stays free); the admin opens it for 24 hours, the owner changes it once (feed
-- event, push to the admin, window closed); the overview shows name, rule and quota to the
-- group (habit private) and nothing to another group; the quota counts from the
-- participant's start with pauses left out; after the end and after cancelling the habit is
-- free again; "Habit-Quote" goals are no longer offered.
--   Group A: a1 (admin) · a2 (participant, owner of the habit) · a3 (member, not taking part)
--   Group B: b
-- Dates are relative to today in Berlin (the season's time zone).

begin;
create extension if not exists pgtap with schema extensions;

select plan(30);

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

create schema tests;
grant usage on schema tests to authenticated;
create function tests.today() returns date language sql stable as $$
  select (now() at time zone 'Europe/Berlin')::date
$$;
create function tests.login(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;
grant execute on all functions in schema tests to authenticated;

-- The habit of a2: "Kein Alkohol" from 20 days ago. Last 10 days: met on −10 … −6, "Nein"
-- on −5, paused −4 and −3, nothing on −2 and −1, today open → 5 of 8 counted days = 62.5 %.
insert into public.habits (id, user_id, template_id)
values ('ab000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222',
        (select id from public.habit_templates where key = 'no_alcohol'));
insert into public.habit_versions (habit_id, valid_from, name, input_type, frequency, time_of_day, source)
values ('ab000000-0000-4000-8000-000000000001', tests.today() - 20, 'Kein Alkohol', 'yes_no',
        'daily', 'evening', 'manual');
insert into public.habit_entries (habit_id, on_date, value)
select 'ab000000-0000-4000-8000-000000000001', tests.today() - d, '{"done":true}'
  from generate_series(6, 10) d;
insert into public.habit_entries (habit_id, on_date, value)
values ('ab000000-0000-4000-8000-000000000001', tests.today() - 5, '{"done":false}');
insert into public.habit_pauses (user_id, from_date, to_date)
values ('22222222-2222-4222-8222-222222222222', tests.today() - 4, tests.today() - 3);
-- A habit of a3.
insert into public.habits (id, user_id) values
  ('ab000000-0000-4000-8000-000000000003', '33333333-3333-4333-8333-333333333333');

set local role authenticated;

-- A season of group A, starting today (a2 then sets up after the start: catch-up).
select tests.login('11111111-1111-4111-8111-111111111111');
select public.create_season('5e000000-0000-4000-8000-000000000001',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Winter', tests.today(), tests.today() + 60,
  p_participants => array['11111111-1111-4111-8111-111111111111'::uuid,
                          '22222222-2222-4222-8222-222222222222'::uuid]);

-- ---------------------------------------------------------------------------
-- Linking
-- ---------------------------------------------------------------------------
select tests.login('33333333-3333-4333-8333-333333333333');
select throws_ok(
  $$select public.link_season_habit('5e000000-0000-4000-8000-000000000001',
      'ab000000-0000-4000-8000-000000000003')$$,
  '42501', 'not_participant', 'only participants link habits');

select tests.login('22222222-2222-4222-8222-222222222222');
select throws_ok(
  $$select public.link_season_habit('5e000000-0000-4000-8000-000000000001',
      'ab000000-0000-4000-8000-000000000003')$$,
  '42501', 'habit_not_found', 'only my own habits');
select lives_ok(
  $$select public.link_season_habit('5e000000-0000-4000-8000-000000000001',
      'ab000000-0000-4000-8000-000000000001')$$,
  'a participant links a habit while the setup is open');
select lives_ok(
  $$select public.link_season_habit('5e000000-0000-4000-8000-000000000001',
      'ab000000-0000-4000-8000-000000000001')$$,
  'linking twice is fine');
select lives_ok(
  $$select public.save_habit('ab000000-0000-4000-8000-000000000001', null, tests.today(),
      '{"name":"Kein Alkohol unter der Woche"}')$$,
  'before ready the rule can still be changed');
select is((select count(*)::integer from public.feed_events where type = 'season_habit_changed'), 0,
  'a change in the setup posts nothing');

-- Ready (with the required trainings goal), so a2 is locked.
select public.create_goal('90000000-0000-4000-8000-000000000001', 'trainings_per_week',
  tests.today(), tests.today() + 60, null, null, 3);
select public.link_season_goal('5e000000-0000-4000-8000-000000000001',
  '90000000-0000-4000-8000-000000000001');
select public.set_season_ready('5e000000-0000-4000-8000-000000000001', true);

-- The season started 10 days ago (moved back as the database owner).
reset role;
update public.seasons set setup_opens_on = tests.today() - 10, starts_on = tests.today() - 10
 where id = '5e000000-0000-4000-8000-000000000001';
update public.season_members set starts_on = tests.today() - 10
 where season_id = '5e000000-0000-4000-8000-000000000001';
set local role authenticated;

-- ---------------------------------------------------------------------------
-- Fixed while the season runs
-- ---------------------------------------------------------------------------
select tests.login('22222222-2222-4222-8222-222222222222');
select throws_ok(
  $$select public.save_habit('ab000000-0000-4000-8000-000000000001', null, tests.today(),
      '{"rule":[]}')$$,
  '42501', 'season_habit_locked', 'the rule of a season habit is fixed once ready');
select throws_ok(
  $$select public.archive_habit('ab000000-0000-4000-8000-000000000001', true)$$,
  '42501', 'season_habit_locked', 'it cannot be archived');
select throws_ok(
  $$select public.unlink_season_habit('5e000000-0000-4000-8000-000000000001',
      'ab000000-0000-4000-8000-000000000001')$$,
  '22023', 'season_goals_locked', 'nor taken out of the season');
select lives_ok(
  $$update public.habits set share_level = 'done' where id = 'ab000000-0000-4000-8000-000000000001'$$,
  'sharing stays free');
update public.habits set share_level = 'private' where id = 'ab000000-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------------------
-- Who sees what
-- ---------------------------------------------------------------------------
select tests.login('11111111-1111-4111-8111-111111111111');
select results_eq(
  $$select user_id, name, input_type, frequency, counted, met, quota_pct, count_unit, locked,
           edit_open_until
      from public.season_habits_overview('5e000000-0000-4000-8000-000000000001', tests.today())$$,
  $$values ('22222222-2222-4222-8222-222222222222'::uuid, 'Kein Alkohol unter der Woche'::text,
            'yes_no'::text, 'daily'::text, 8, 5, 62.5::numeric, 'days'::text, true,
            null::timestamptz)$$,
  'the group sees name, rule and quota of a private habit – from the start, pauses left out');
select is((select count(*)::integer from public.habits where id = 'ab000000-0000-4000-8000-000000000001'),
  0, 'the habit itself stays private');

select tests.login('55555555-5555-4555-8555-555555555555');
select is((select count(*)::integer from public.season_habits), 0,
  'group B sees no season habits of group A');
select is((select count(*)::integer
             from public.season_habits_overview('5e000000-0000-4000-8000-000000000001', tests.today())),
  0, 'nor through the overview');

-- ---------------------------------------------------------------------------
-- The admin opens the rule for one change
-- ---------------------------------------------------------------------------
select throws_ok(
  $$select public.open_season_habit_edit('5e000000-0000-4000-8000-000000000001',
      'ab000000-0000-4000-8000-000000000001')$$,
  '42501', 'not_group_admin', 'the admin of another group cannot open it');
select tests.login('22222222-2222-4222-8222-222222222222');
select throws_ok(
  $$select public.open_season_habit_edit('5e000000-0000-4000-8000-000000000001',
      'ab000000-0000-4000-8000-000000000001')$$,
  '42501', 'not_group_admin', 'the owner cannot open it');

select tests.login('11111111-1111-4111-8111-111111111111');
select ok(
  (select t between now() + interval '23 hours 59 minutes' and now() + interval '24 hours 1 minute'
     from (select public.open_season_habit_edit('5e000000-0000-4000-8000-000000000001',
             'ab000000-0000-4000-8000-000000000001') as t offset 0) x),
  'the admin opens it for 24 hours');

select tests.login('22222222-2222-4222-8222-222222222222');
select results_eq(
  $$select event, category, target_type, data ->> 'habitId'
      from public.notifications where recipient_id = '22222222-2222-4222-8222-222222222222'
       and event = 'season_habit_edit_open'$$,
  $$values ('season_habit_edit_open'::text, 'seasons'::text, 'season'::text,
            'ab000000-0000-4000-8000-000000000001'::text)$$,
  'the owner is told');
select throws_ok(
  $$select public.archive_habit('ab000000-0000-4000-8000-000000000001', true)$$,
  '42501', 'season_habit_locked', 'the window is for the rule: archiving stays refused');
select lives_ok(
  $$select public.save_habit('ab000000-0000-4000-8000-000000000001', null, tests.today(),
      '{"name":"Kein Alkohol"}')$$,
  'the owner changes the rule once');
select results_eq(
  $$select actor_id, target_type, target_id, data ->> 'name'
      from public.feed_events where type = 'season_habit_changed'$$,
  $$values ('22222222-2222-4222-8222-222222222222'::uuid, 'season'::text,
            '5e000000-0000-4000-8000-000000000001'::uuid, 'Kein Alkohol'::text)$$,
  'the change is in the feed');
select throws_ok(
  $$select public.save_habit('ab000000-0000-4000-8000-000000000001', null, tests.today(),
      '{"name":"Noch mal"}')$$,
  '42501', 'season_habit_locked', 'and the window is closed again');

select tests.login('11111111-1111-4111-8111-111111111111');
select results_eq(
  $$select event, actor_id from public.notifications
     where recipient_id = '11111111-1111-4111-8111-111111111111' and event = 'season_habit_changed'$$,
  $$values ('season_habit_changed'::text, '22222222-2222-4222-8222-222222222222'::uuid)$$,
  'the admin is told about the change');
select is(
  (select edit_open_until from public.season_habits_overview('5e000000-0000-4000-8000-000000000001',
     tests.today())),
  null::timestamptz, 'the overview shows no open window any more');

-- ---------------------------------------------------------------------------
-- Free again after the end and after cancelling
-- ---------------------------------------------------------------------------
reset role;
update public.seasons set ends_on = tests.today() - 1
 where id = '5e000000-0000-4000-8000-000000000001';
set local role authenticated;
select tests.login('22222222-2222-4222-8222-222222222222');
select lives_ok(
  $$select public.save_habit('ab000000-0000-4000-8000-000000000001', null, tests.today(),
      '{"name":"Nach der Saison"}')$$,
  'after the end the rule is free again');
select lives_ok(
  $$select public.archive_habit('ab000000-0000-4000-8000-000000000001', true)$$,
  'and the habit can be archived');
select is((select count(*)::integer from public.season_habits), 1,
  'archiving after the end keeps the season''s record');

reset role;
update public.seasons set ends_on = tests.today() + 60
 where id = '5e000000-0000-4000-8000-000000000001';
update public.habits set archived_at = null where id = 'ab000000-0000-4000-8000-000000000001';
set local role authenticated;
select tests.login('11111111-1111-4111-8111-111111111111');
select public.cancel_season('5e000000-0000-4000-8000-000000000001');
select is((select count(*)::integer from public.season_habits), 0,
  'cancelling takes the habits out of the season');
select tests.login('22222222-2222-4222-8222-222222222222');
select lives_ok(
  $$select public.save_habit('ab000000-0000-4000-8000-000000000001', null, tests.today(),
      '{"name":"Frei"}')$$,
  'and the rule is free');

-- ---------------------------------------------------------------------------
-- "Habit-Quote" is no longer offered
-- ---------------------------------------------------------------------------
select throws_ok(
  $$select public.create_goal(null, 'habit_rate', tests.today(), tests.today() + 30, null, null, 90,
      p_habit_id => 'ab000000-0000-4000-8000-000000000001')$$,
  '22023', 'metric_not_offered', 'no new habit quota goals');

select * from finish();
rollback;
