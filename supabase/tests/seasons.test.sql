-- Seasons (8b): only admins create / change / cancel; who sees what (group A vs B,
-- participants vs other members, super admin); setup (link goals, ready needs the required
-- metrics); the lock at the start (owner before / not after, admin correction with feed
-- event and notification, archive / discard refused, unlinked goals free); late entry;
-- season goals of others with kg still masked; goals commentable; the hourly job (setup
-- push, reminder the day before, start card and push – once each); markers; cancelling.
--   Group A: a1 (admin, creates S1) · a2 (participant) · a3 (member, not participating) ·
--            a4 (added late)
--   Group B: b (admin, creates S2) · b2 (member)
--   sa: super admin, in no group
-- Dates are relative to today in Berlin (the season's time zone), so the test does not
-- depend on the day it runs.

begin;
create extension if not exists pgtap with schema extensions;

select plan(97);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'a1@test.local'),
  ('22222222-2222-4222-8222-222222222222', 'a2@test.local'),
  ('33333333-3333-4333-8333-333333333333', 'a3@test.local'),
  ('44444444-4444-4444-8444-444444444444', 'a4@test.local'),
  ('55555555-5555-4555-8555-555555555555', 'b@test.local'),
  ('66666666-6666-4666-8666-666666666666', 'b2@test.local'),
  ('77777777-7777-4777-8777-777777777777', 'sa@test.local');
insert into public.profiles (id, display_name, color, is_super_admin) values
  ('11111111-1111-4111-8111-111111111111', 'A1', 'person-1', false),
  ('22222222-2222-4222-8222-222222222222', 'A2', 'person-2', false),
  ('33333333-3333-4333-8333-333333333333', 'A3', 'person-3', false),
  ('44444444-4444-4444-8444-444444444444', 'A4', 'person-4', false),
  ('55555555-5555-4555-8555-555555555555', 'B', 'person-5', false),
  ('66666666-6666-4666-8666-666666666666', 'B2', 'person-6', false),
  ('77777777-7777-4777-8777-777777777777', 'SA', 'person-7', true);
insert into public.groups (id, name) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'B');
insert into public.group_members (group_id, user_id, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'admin'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'member'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333', 'member'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '44444444-4444-4444-8444-444444444444', 'member'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '55555555-5555-4555-8555-555555555555', 'admin'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '66666666-6666-4666-8666-666666666666', 'member');

create schema tests;
grant usage on schema tests to authenticated;
create function tests.today() returns date language sql stable as $$
  select (now() at time zone 'Europe/Berlin')::date
$$;
create function tests.login(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;
-- A moment in Berlin time.
create function tests.at(p_day date, p_time time) returns timestamptz language sql stable as $$
  select (p_day + p_time) at time zone 'Europe/Berlin'
$$;
grant execute on all functions in schema tests to authenticated;

set local role authenticated;

-- ---------------------------------------------------------------------------
-- Creating (admins only)
-- ---------------------------------------------------------------------------
select tests.login('22222222-2222-4222-8222-222222222222');
select throws_ok(
  $$select public.create_season(null, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'X',
      tests.today() + 3, tests.today() + 90)$$,
  '42501', 'not_group_admin', 'a member cannot create a season');
select tests.login('55555555-5555-4555-8555-555555555555');
select throws_ok(
  $$select public.create_season(null, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'X',
      tests.today() + 3, tests.today() + 90)$$,
  '42501', 'not_group_admin', 'the admin of group B cannot create one in group A');
select tests.login('77777777-7777-4777-8777-777777777777');
select throws_ok(
  $$select public.create_season(null, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'X',
      tests.today() + 3, tests.today() + 90)$$,
  '42501', 'not_group_admin', 'the super admin cannot create one either');

select tests.login('11111111-1111-4111-8111-111111111111');
select throws_ok(
  $$select public.create_season(null, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'X',
      tests.today() - 1, tests.today() + 90)$$,
  '22023', 'start_in_the_past', 'a season cannot start in the past');
select throws_ok(
  $$select public.create_season(null, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'X',
      tests.today() + 3, tests.today() + 90, p_participants => array['55555555-5555-4555-8555-555555555555'::uuid])$$,
  '22023', 'participant_not_in_group', 'participants must be group members');
select throws_ok(
  $$select public.create_season(null, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'X',
      tests.today() + 3, tests.today() + 90, p_required_metrics => array['nope'])$$,
  '22023', 'unknown_metric', 'required metrics must exist');
select throws_ok(
  $$insert into public.seasons (group_id, name, setup_opens_on, starts_on, ends_on)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'X', current_date, current_date + 1, current_date + 9)$$,
  '42501', null, 'seasons are not written directly');

select is(
  public.create_season('5e000000-0000-4000-8000-000000000001',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', ' Winter ', tests.today() + 3, tests.today() + 90,
    p_participants => array['11111111-1111-4111-8111-111111111111'::uuid,
                            '22222222-2222-4222-8222-222222222222'::uuid],
    p_weigh_weekly => true, p_checkin_every_weeks => 4),
  '5e000000-0000-4000-8000-000000000001'::uuid, 'the admin creates a season');
select results_eq(
  $$select name, setup_opens_on, weigh_weekly, checkin_every_weeks::integer, required_metrics,
           time_zone, created_by
      from public.seasons$$,
  $$values ('Winter'::text, tests.today(), true, 4, '{trainings_per_week}'::text[],
            'Europe/Berlin'::text, '11111111-1111-4111-8111-111111111111'::uuid)$$,
  'name trimmed, setup open today, rules stored, only trainings per week required by default');
select results_eq(
  $$select user_id, starts_on, late_entry, ready_at from public.season_members order by user_id$$,
  $$values ('11111111-1111-4111-8111-111111111111'::uuid, tests.today() + 3, false, null::timestamptz),
           ('22222222-2222-4222-8222-222222222222'::uuid, tests.today() + 3, false, null::timestamptz)$$,
  'the chosen participants with the season''s start');
select throws_ok(
  $$select public.create_season(null, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Y',
      tests.today() + 90, tests.today() + 120)$$,
  '22023', 'season_overlaps', 'seasons of a group do not overlap');
select results_eq(
  $$select fe.type, fe.target_type, fe.target_id, fd.kind
      from public.feed_events fe join public.feed_days fd on fd.id = fe.feed_day_id
     where fe.type like 'season%'$$,
  $$values ('season_announced'::text, 'season'::text,
            '5e000000-0000-4000-8000-000000000001'::uuid, 'season'::text)$$,
  'creating posts "season_announced" on its own season card');

-- ---------------------------------------------------------------------------
-- Who sees what
-- ---------------------------------------------------------------------------
select results_eq(
  $$select phase, week_count, days_until_start, participant_count, is_participant, my_locked,
           my_missing_metrics
      from public.group_seasons('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.today())$$,
  $$values ('setup'::text, 13, 3, 2, true, false, '{trainings_per_week}'::text[])$$,
  'group_seasons: in setup, 13 weeks, 3 days to go; the admin still misses the trainings goal');

select tests.login('33333333-3333-4333-8333-333333333333');
select results_eq(
  $$select count(*)::integer, bool_and(not is_participant), bool_and(my_locked is null)
      from public.group_seasons('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.today())$$,
  $$values (1, true, true)$$, 'a member who does not take part sees the season, not as participant');
select results_eq(
  $$select count(*)::integer from public.season_members$$, $$values (2)$$,
  'and its participants');

select tests.login('55555555-5555-4555-8555-555555555555');
select is((select count(*)::integer from public.seasons), 0, 'group B sees no season of group A');
select is((select count(*)::integer from public.season_members), 0, 'nor its participants');
select is((select count(*)::integer
             from public.group_seasons('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.today())), 0,
  'nor through group_seasons');
select is((select count(*)::integer
             from public.season_participants('5e000000-0000-4000-8000-000000000001')), 0,
  'nor through season_participants');

select tests.login('77777777-7777-4777-8777-777777777777');
select is((select count(*)::integer from public.seasons), 1,
  'the super admin sees seasons (as groups and their members)');

-- ---------------------------------------------------------------------------
-- Setup: a2 sets goals, ready needs the required metrics
-- ---------------------------------------------------------------------------
select tests.login('33333333-3333-4333-8333-333333333333');
select public.create_goal('90000000-0000-4000-8000-000000000009', 'trainings_per_week',
  tests.today(), tests.today() + 30, null, 2, 3);
select throws_ok(
  $$select public.link_season_goal('5e000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000009')$$,
  '42501', 'not_participant', 'a non-participant cannot link a goal');
select throws_ok(
  $$select public.set_season_ready('5e000000-0000-4000-8000-000000000001', true)$$,
  '42501', 'not_participant', 'nor mark themselves ready');

select tests.login('22222222-2222-4222-8222-222222222222');
select public.create_goal('90000000-0000-4000-8000-000000000001', 'trainings_per_week',
  tests.today(), tests.today() + 30, null, 2, 3);
select public.create_goal('90000000-0000-4000-8000-000000000002', 'body_weight',
  tests.today(), tests.today() + 30, 85, 83, 80);
select throws_ok(
  $$select public.set_season_ready('5e000000-0000-4000-8000-000000000001', true)$$,
  '22023', 'season_goals_missing', 'ready needs a goal for every required metric');
select throws_ok(
  $$select public.link_season_goal('5e000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000009')$$,
  '42501', 'goal_not_found', 'only my own goals');
select lives_ok(
  $$select public.link_season_goal('5e000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001')$$,
  'a participant links a goal during the setup');
select lives_ok(
  $$select public.link_season_goal('5e000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001')$$,
  'linking again does nothing');
select public.link_season_goal('5e000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000002');
select results_eq(
  $$select id, starts_on, ends_on, visibility from public.goals
     where id in ('90000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000002')
     order by id$$,
  $$values ('90000000-0000-4000-8000-000000000001'::uuid, tests.today() + 3, tests.today() + 90, 'shared'::text),
           ('90000000-0000-4000-8000-000000000002'::uuid, tests.today() + 3, tests.today() + 90, 'shared'::text)$$,
  'a linked goal gets the season period and becomes shared');
select results_eq(
  $$select valid_from from public.goal_versions where goal_id = '90000000-0000-4000-8000-000000000001'$$,
  $$values (tests.today() + 3)$$, 'with one version from the season start');
select lives_ok(
  $$select public.set_season_ready('5e000000-0000-4000-8000-000000000001', true)$$,
  'ready once the trainings goal is there');
select results_eq(
  $$select is_participant, my_ready_at is not null, my_locked, my_missing_metrics, ready_count
      from public.group_seasons('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.today())$$,
  $$values (true, true, false, '{}'::text[], 1)$$, 'my setup state: ready, nothing missing, not locked');
select lives_ok(
  $$select public.update_goal('90000000-0000-4000-8000-000000000001', tests.today() + 3,
      tests.today() + 90, null, 3, 4, 'shared')$$,
  'before the start the owner can still change a season goal');
select results_eq(
  $$select valid_from, min_value, target_value from public.goal_versions
     where goal_id = '90000000-0000-4000-8000-000000000001'$$,
  $$values (tests.today() + 3, 3.00::numeric, 4.00::numeric)$$,
  'a change before the start stays the one version from the start');
select throws_ok(
  $$select public.update_goal('90000000-0000-4000-8000-000000000001', tests.today(),
      tests.today() + 90, null, 3, 4, 'shared')$$,
  '22023', 'season_goal_period_fixed', 'the period of a season goal is the season''s');
select throws_ok(
  $$select public.update_goal('90000000-0000-4000-8000-000000000001', tests.today() + 3,
      tests.today() + 90, null, 3, 4, 'private')$$,
  '22023', 'season_goal_must_be_shared', 'a season goal stays shared');
select public.unlink_season_goal('5e000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001');
select results_eq(
  $$select ready_at from public.season_members
     where user_id = '22222222-2222-4222-8222-222222222222'$$,
  $$values (null::timestamptz)$$, 'unlinking the required goal takes back "Bereit"');
select public.link_season_goal('5e000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001');
select public.set_season_ready('5e000000-0000-4000-8000-000000000001', true);

select tests.login('11111111-1111-4111-8111-111111111111');
select throws_ok(
  $$select public.correct_season_goal('90000000-0000-4000-8000-000000000001', null, 2, 5)$$,
  '22023', 'season_goal_not_locked', 'before the start the admin does not correct (the owner edits)');

-- Changing the season before the start
select tests.login('22222222-2222-4222-8222-222222222222');
select throws_ok(
  $$select public.update_season('5e000000-0000-4000-8000-000000000001', 'Winter', tests.today() + 4,
      tests.today() + 90, tests.today(), true, 4, '{trainings_per_week}')$$,
  '42501', 'not_group_admin', 'only the admin changes a season');
select tests.login('11111111-1111-4111-8111-111111111111');
select public.update_season('5e000000-0000-4000-8000-000000000001', 'Winter', tests.today() + 4,
  tests.today() + 91, tests.today(), true, 4, '{trainings_per_week,habit_rate}');
select tests.login('22222222-2222-4222-8222-222222222222');
select results_eq(
  $$select starts_on, ends_on from public.goals where id = '90000000-0000-4000-8000-000000000002'$$,
  $$values (tests.today() + 4, tests.today() + 91)$$,
  'moving the season moves the period of the season goals');
select results_eq(
  $$select my_starts_on, my_ready_at, my_missing_metrics
      from public.group_seasons('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.today())$$,
  $$values (tests.today() + 4, null::timestamptz, '{habit_rate}'::text[])$$,
  'a new required metric takes back "Bereit" of those missing it');
select tests.login('11111111-1111-4111-8111-111111111111');
select public.update_season('5e000000-0000-4000-8000-000000000001', 'Winter', tests.today() + 3,
  tests.today() + 90, tests.today(), true, 4, '{trainings_per_week}');
select tests.login('22222222-2222-4222-8222-222222222222');
select public.set_season_ready('5e000000-0000-4000-8000-000000000001', true);

-- Season goals of the others: visible to the group, kg still masked
select tests.login('33333333-3333-4333-8333-333333333333');
select results_eq(
  $$select sg.user_id, sg.goal_id from public.season_goals sg order by sg.goal_id$$,
  $$values ('22222222-2222-4222-8222-222222222222'::uuid, '90000000-0000-4000-8000-000000000001'::uuid),
           ('22222222-2222-4222-8222-222222222222'::uuid, '90000000-0000-4000-8000-000000000002'::uuid)$$,
  'members see which goals are in the season');
select results_eq(
  $$select id, values_hidden, start_value, target_value
      from public.goal_progress('22222222-2222-4222-8222-222222222222', tests.today())
     order by id$$,
  $$values ('90000000-0000-4000-8000-000000000001'::uuid, false, null::numeric, 4.00::numeric),
           ('90000000-0000-4000-8000-000000000002'::uuid, true, null::numeric, null::numeric)$$,
  'the goals of a participant are visible, the weight kg stay hidden (weight not shared)');
select tests.login('55555555-5555-4555-8555-555555555555');
select is((select count(*)::integer from public.season_goals), 0, 'group B sees no season goals');
select is((select count(*)::integer
             from public.goal_progress('22222222-2222-4222-8222-222222222222', tests.today())), 0,
  'nor the goals');
select tests.login('77777777-7777-4777-8777-777777777777');
select is((select count(*)::integer from public.season_goals), 0,
  'the super admin does not see the goals of a season');

-- Goals are commentable
select tests.login('33333333-3333-4333-8333-333333333333');
select lives_ok(
  $$select public.post_comment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'goal',
      '90000000-0000-4000-8000-000000000001', 'Nur 4?')$$,
  'a group member comments on a shared goal');
select tests.login('22222222-2222-4222-8222-222222222222');
select results_eq(
  $$select category, event, target_type from public.notifications where event = 'comment'$$,
  $$values ('comments_on_mine'::text, 'comment'::text, 'goal'::text)$$,
  'the owner is told about the comment on their goal');
select tests.login('55555555-5555-4555-8555-555555555555');
select throws_ok(
  $$select public.post_comment('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'goal',
      '90000000-0000-4000-8000-000000000001', 'x')$$,
  'P0001', 'target_not_found', 'someone from another group cannot comment on it');

-- The setup push
select tests.login('22222222-2222-4222-8222-222222222222');
select results_eq(
  $$select category, event, actor_id, target_type, target_id from public.notifications
     where event like 'season%'$$,
  $$values ('seasons'::text, 'season_setup'::text, '11111111-1111-4111-8111-111111111111'::uuid,
            'season'::text, '5e000000-0000-4000-8000-000000000001'::uuid)$$,
  'participants get the setup push on creation');
select tests.login('11111111-1111-4111-8111-111111111111');
select is((select count(*)::integer from public.notifications where event like 'season%'), 0,
  'not the admin who created it');
select tests.login('33333333-3333-4333-8333-333333333333');
select is((select count(*)::integer from public.notifications where event like 'season%'), 0,
  'nor members who do not take part');

-- ---------------------------------------------------------------------------
-- The start: goals locked (simulated by moving the season to start today)
-- ---------------------------------------------------------------------------
reset role;
update public.seasons set setup_opens_on = tests.today(), starts_on = tests.today()
 where id = '5e000000-0000-4000-8000-000000000001';
update public.season_members set starts_on = tests.today()
 where season_id = '5e000000-0000-4000-8000-000000000001';
update public.goals set starts_on = tests.today()
 where id in ('90000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000002');
update public.goal_versions set valid_from = tests.today()
 where goal_id in ('90000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000002');
set local role authenticated;

select tests.login('22222222-2222-4222-8222-222222222222');
select results_eq(
  $$select phase, week_number, my_locked
      from public.group_seasons('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.today())$$,
  $$values ('running'::text, 1, true)$$, 'running, week 1, my goals locked');
select throws_ok(
  $$select public.update_goal('90000000-0000-4000-8000-000000000001', tests.today(),
      tests.today() + 90, null, 1, 2, 'shared')$$,
  '42501', 'season_goal_locked', 'after the start the owner cannot change a season goal');
select throws_ok(
  $$select public.archive_goal('90000000-0000-4000-8000-000000000001', true)$$,
  '42501', 'season_goal_locked', 'nor archive it');
select throws_ok(
  $$select public.discard_goal('90000000-0000-4000-8000-000000000001')$$,
  '42501', 'season_goal_locked', 'nor discard it');
select throws_ok(
  $$select public.unlink_season_goal('5e000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001')$$,
  '22023', 'season_goals_locked', 'nor take it out of the season');
select throws_ok(
  $$select public.set_season_ready('5e000000-0000-4000-8000-000000000001', false)$$,
  '22023', 'season_goals_locked', 'nor take back "Bereit"');
select public.create_goal('90000000-0000-4000-8000-000000000003', 'trainings_per_week',
  tests.today(), tests.today() + 30, null, null, 5);
select lives_ok(
  $$select public.update_goal('90000000-0000-4000-8000-000000000003', tests.today(),
      tests.today() + 30, null, null, 6, 'private')$$,
  'a private extra goal stays freely editable');
select lives_ok(
  $$select public.archive_goal('90000000-0000-4000-8000-000000000003', true)$$,
  'and can be archived');
select throws_ok(
  $$select public.link_season_goal('5e000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000003')$$,
  '22023', 'season_goals_locked', 'no new goals for the season after the start');
select throws_ok(
  $$select public.correct_season_goal('90000000-0000-4000-8000-000000000001', null, 2, 5)$$,
  '42501', 'not_group_admin', 'the owner cannot correct their own locked goal');

select tests.login('11111111-1111-4111-8111-111111111111');
select throws_ok(
  $$select public.update_goal('90000000-0000-4000-8000-000000000001', tests.today(),
      tests.today() + 90, null, 1, 2, 'shared')$$,
  '42501', 'goal_not_found', 'the admin cannot use the owner''s update');
select throws_ok(
  $$select public.archive_goal('90000000-0000-4000-8000-000000000001', true)$$,
  '42501', 'goal_not_found', 'nor archive someone''s goal');
select lives_ok(
  $$select public.correct_season_goal('90000000-0000-4000-8000-000000000001', null, 2, 5)$$,
  'the admin corrects a locked season goal');
reset role;
select results_eq(
  $$select valid_from, min_value, target_value from public.goal_versions
     where goal_id = '90000000-0000-4000-8000-000000000001'$$,
  $$values (tests.today(), 2.00::numeric, 5.00::numeric)$$,
  'the correction applies from the goal''s start');
select results_eq(
  $$select fe.actor_id, fe.target_type, fe.target_id, fe.data ->> 'ownerId', fe.data ? 'target',
           fd.kind
      from public.feed_events fe join public.feed_days fd on fd.id = fe.feed_day_id
     where fe.type = 'season_goal_corrected'$$,
  $$values ('11111111-1111-4111-8111-111111111111'::uuid, 'goal'::text,
            '90000000-0000-4000-8000-000000000001'::uuid,
            '22222222-2222-4222-8222-222222222222'::text, false, 'season'::text)$$,
  'every correction posts a visible feed event (without values)');
select results_eq(
  $$select recipient_id, category, event, actor_id from public.notifications
     where event = 'season_goal_corrected'$$,
  $$values ('22222222-2222-4222-8222-222222222222'::uuid, 'seasons'::text,
            'season_goal_corrected'::text, '11111111-1111-4111-8111-111111111111'::uuid)$$,
  'and tells the owner');
select is(current_setting('app.season_correction', true), '',
  'the correction mark does not outlive the correction');
set local role authenticated;
select tests.login('11111111-1111-4111-8111-111111111111');
select throws_ok(
  $$select public.update_season('5e000000-0000-4000-8000-000000000001', 'Winter', tests.today(),
      tests.today() + 100, tests.today(), true, 4, '{trainings_per_week}')$$,
  '22023', 'season_started', 'after the start the period cannot change');
select lives_ok(
  $$select public.update_season('5e000000-0000-4000-8000-000000000001', 'Winter 26/27',
      tests.today(), tests.today() + 90, tests.today(), true, 4, '{trainings_per_week}')$$,
  'but the name can');

-- ---------------------------------------------------------------------------
-- Late entry
-- ---------------------------------------------------------------------------
select tests.login('22222222-2222-4222-8222-222222222222');
select throws_ok(
  $$select public.add_season_participant('5e000000-0000-4000-8000-000000000001', '44444444-4444-4444-8444-444444444444')$$,
  '42501', 'not_group_admin', 'only the admin adds participants');
select tests.login('11111111-1111-4111-8111-111111111111');
select throws_ok(
  $$select public.add_season_participant('5e000000-0000-4000-8000-000000000001', '55555555-5555-4555-8555-555555555555')$$,
  '22023', 'participant_not_in_group', 'only group members');
select lives_ok(
  $$select public.add_season_participant('5e000000-0000-4000-8000-000000000001', '44444444-4444-4444-8444-444444444444')$$,
  'the admin adds a late entrant');
select results_eq(
  $$select starts_on, late_entry, locked, missing_metrics
      from public.season_participants('5e000000-0000-4000-8000-000000000001')
     where user_id = '44444444-4444-4444-8444-444444444444'$$,
  $$values (tests.today(), true, false, '{trainings_per_week}'::text[])$$,
  'with their own start and their own setup');
select tests.login('44444444-4444-4444-8444-444444444444');
select results_eq(
  $$select event from public.notifications where event like 'season%'$$,
  $$values ('season_setup'::text)$$, 'the late entrant gets the setup push');
select public.create_goal('90000000-0000-4000-8000-000000000004', 'trainings_per_week',
  tests.today() + 1, tests.today() + 20, null, null, 3);
select lives_ok(
  $$select public.link_season_goal('5e000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000004')$$,
  'the late entrant links a goal after the start');
select results_eq(
  $$select starts_on, ends_on from public.goals where id = '90000000-0000-4000-8000-000000000004'$$,
  $$values (tests.today(), tests.today() + 90)$$, 'from their own start to the season''s end');
select lives_ok(
  $$select public.update_goal('90000000-0000-4000-8000-000000000004', tests.today(),
      tests.today() + 90, null, 2, 3, 'shared')$$,
  'and can change it until ready');
select public.set_season_ready('5e000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$select public.update_goal('90000000-0000-4000-8000-000000000004', tests.today(),
      tests.today() + 90, null, 2, 4, 'shared')$$,
  '42501', 'season_goal_locked', 'once ready, the late entrant''s goals are locked');

-- ---------------------------------------------------------------------------
-- The hourly job (season S2 of group B: setup opens in 5 days, starts in 10)
-- ---------------------------------------------------------------------------
select tests.login('55555555-5555-4555-8555-555555555555');
select public.create_season('5e000000-0000-4000-8000-000000000002',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Frühling', tests.today() + 10, tests.today() + 60,
  tests.today() + 5);
select tests.login('11111111-1111-4111-8111-111111111111');
select is((select count(*)::integer from public.seasons), 1, 'group A does not see group B''s season');
reset role;
select is((select count(*)::integer from public.notifications
            where target_id = '5e000000-0000-4000-8000-000000000002'), 0,
  'no setup push while the setup is not open');
select private.run_season_jobs(tests.at(tests.today() + 5, '06:59'));
select is((select count(*)::integer from public.notifications
            where target_id = '5e000000-0000-4000-8000-000000000002'), 0,
  'not before 7:00 on the day the setup opens');
select private.run_season_jobs(tests.at(tests.today() + 5, '07:10'));
select private.run_season_jobs(tests.at(tests.today() + 6, '09:00'));
select results_eq(
  $$select recipient_id, event, actor_id from public.notifications
     where target_id = '5e000000-0000-4000-8000-000000000002'$$,
  $$values ('66666666-6666-4666-8666-666666666666'::uuid, 'season_setup'::text,
            '55555555-5555-4555-8555-555555555555'::uuid)$$,
  'from 7:00 the setup push, once, not to the admin who created it');
select private.run_season_jobs(tests.at(tests.today() + 9, '17:59'));
select is((select count(*)::integer from public.notifications
            where event = 'season_ready_reminder'), 0, 'no reminder before 18:00 the day before');
select private.run_season_jobs(tests.at(tests.today() + 9, '18:00'));
select private.run_season_jobs(tests.at(tests.today() + 9, '19:00'));
select results_eq(
  $$select recipient_id from public.notifications where event = 'season_ready_reminder'
     order by recipient_id$$,
  $$values ('55555555-5555-4555-8555-555555555555'::uuid), ('66666666-6666-4666-8666-666666666666'::uuid)$$,
  'the day before the start a reminder, once, to every participant not ready');
select private.run_season_jobs(tests.at(tests.today() + 10, '06:59'));
select is((select count(*)::integer from public.feed_events where type = 'season_started'), 0,
  'no start card before 7:00');
select private.run_season_jobs(tests.at(tests.today() + 10, '07:05'));
select private.run_season_jobs(tests.at(tests.today() + 10, '08:05'));
select results_eq(
  $$select fe.group_id, fe.actor_id, fe.target_id, fd.kind, fd.day
      from public.feed_events fe join public.feed_days fd on fd.id = fe.feed_day_id
     where fe.type = 'season_started'$$,
  $$values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, '55555555-5555-4555-8555-555555555555'::uuid,
            '5e000000-0000-4000-8000-000000000002'::uuid, 'season'::text, tests.today() + 10)$$,
  'on the start day from 7:00 "Saison gestartet", once, on the group''s season card');
select results_eq(
  $$select recipient_id from public.notifications where event = 'season_started'
     order by recipient_id$$,
  $$values ('55555555-5555-4555-8555-555555555555'::uuid), ('66666666-6666-4666-8666-666666666666'::uuid)$$,
  'and the start push to the participants, once');
select is((select count(*)::integer from public.notifications
            where group_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
              and event in ('season_ready_reminder', 'season_started')), 0,
  'the job sent nothing more for the running season of group A');
set local role authenticated;

-- ---------------------------------------------------------------------------
-- Markers
-- ---------------------------------------------------------------------------
select tests.login('33333333-3333-4333-8333-333333333333');
select results_eq(
  $$select on_date, kind, season_id from public.season_day_markers(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.today() - 1, tests.today() + 100)$$,
  $$values (tests.today(), 'season_start'::text, '5e000000-0000-4000-8000-000000000001'::uuid),
           (tests.today() + 90, 'season_end'::text, '5e000000-0000-4000-8000-000000000001'::uuid)$$,
  'the group markers: season start and end');
select is((select count(*)::integer from public.season_day_markers(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', tests.today(), tests.today() + 100)), 0,
  'no markers of another group');

select tests.login('22222222-2222-4222-8222-222222222222');
insert into public.body_settings (user_id, weigh_reminder_days, checkin_every_weeks)
values ('22222222-2222-4222-8222-222222222222', '{1}', 4);
select results_eq(
  $$select count(*) filter (where kind = 'weigh_day')::integer,
           bool_and(extract(isodow from on_date) = 1) filter (where kind = 'weigh_day'),
           max(on_date) filter (where kind = 'checkin_due')
      from public.body_day_markers(tests.today(), tests.today() + 6, tests.today())$$,
  $$values (1, true, tests.today())$$,
  'my markers: one weigh day (Monday) in a week, the first check-in due today');
select public.save_body_checkin(tests.today() - 7, '{"bauch": 90}');
select results_eq(
  $$select on_date from public.body_day_markers(tests.today(), tests.today() + 30, tests.today())
     where kind = 'checkin_due'$$,
  $$values (tests.today() + 21)$$, 'the next check-in four weeks after the last');
select tests.login('33333333-3333-4333-8333-333333333333');
select is((select count(*)::integer
             from public.body_day_markers(tests.today(), tests.today() + 30, tests.today())), 0,
  'markers are only my own');

-- ---------------------------------------------------------------------------
-- Cancelling
-- ---------------------------------------------------------------------------
select tests.login('22222222-2222-4222-8222-222222222222');
select throws_ok(
  $$select public.cancel_season('5e000000-0000-4000-8000-000000000001')$$,
  '42501', 'not_group_admin', 'only the admin cancels');
select tests.login('11111111-1111-4111-8111-111111111111');
select public.cancel_season('5e000000-0000-4000-8000-000000000001');
select results_eq(
  $$select phase, (select count(*)::integer from public.season_goals)
      from public.group_seasons('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.today())$$,
  $$values ('cancelled'::text, 0)$$, 'cancelled: its goals are out of the season');
select is((select count(*)::integer from public.season_day_markers(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tests.today() - 1, tests.today() + 100)), 0,
  'a cancelled season has no markers');
select tests.login('22222222-2222-4222-8222-222222222222');
select lives_ok(
  $$select public.update_goal('90000000-0000-4000-8000-000000000001', tests.today(),
      tests.today() + 90, null, 1, 2, 'private')$$,
  'and they are ordinary goals again');

select * from finish();
rollback;
