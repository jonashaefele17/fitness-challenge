-- Invitations to plans (5b): the owner invites group mates; only invitees answer; a
-- proposal moves the date; changes by the owner reset the answers; "Ich komm mit";
-- other groups see nothing.
--   a1 (owner), a2, a3 share group A · b is in group B

begin;
create extension if not exists pgtap with schema extensions;

select plan(22);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'a1@test.local'),
  ('22222222-2222-4222-8222-222222222222', 'a2@test.local'),
  ('44444444-4444-4444-8444-444444444444', 'a3@test.local'),
  ('33333333-3333-4333-8333-333333333333', 'b@test.local');
insert into public.profiles (id, display_name, color) values
  ('11111111-1111-4111-8111-111111111111', 'A1', 'person-1'),
  ('22222222-2222-4222-8222-222222222222', 'A2', 'person-2'),
  ('44444444-4444-4444-8444-444444444444', 'A3', 'person-4'),
  ('33333333-3333-4333-8333-333333333333', 'B', 'person-3');
insert into public.groups (id, name) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'A'), ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'B');
insert into public.group_members (group_id, user_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '44444444-4444-4444-8444-444444444444'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '33333333-3333-4333-8333-333333333333');

-- a1: Mondays in December 2026 (7, 14, 21, 28), 18:00; and a single plan on the 12th
insert into public.plans (id, user_id, kind, training_type_id, starts_on, start_time, repeat_weekdays, repeat_until)
values ('c0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'training',
        (select id from public.training_types where name = 'Studio' and owner_id is null),
        '2026-12-07', '18:00', '{1}', '2026-12-31');
insert into public.plans (id, user_id, kind, title, starts_on, start_time)
values ('c0000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'event',
        'Stadtlauf', '2026-12-12', '10:00');

create schema tests;
grant usage on schema tests to authenticated;
create function tests.notes(p_user uuid, p_event text) returns bigint
language sql security definer set search_path = '' as $$
  select count(*) from public.notifications where recipient_id = p_user and event = p_event
$$;
grant execute on function tests.notes(uuid, text) to authenticated;

-- the owner invites
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select lives_ok(
  $$select public.set_plan_participants('c0000000-0000-4000-8000-000000000001',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '{22222222-2222-4222-8222-222222222222}')$$,
  'the owner invites a group mate to the series');
select throws_ok(
  $$select public.set_plan_participants('c0000000-0000-4000-8000-000000000001',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '{33333333-3333-4333-8333-333333333333}')$$,
  'P0001', 'not_in_group', 'but nobody from another group');
select is(tests.notes('22222222-2222-4222-8222-222222222222', 'plan_invite'), 1::bigint,
  'the invited person is told');
select public.set_plan_participants('c0000000-0000-4000-8000-000000000002',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '{22222222-2222-4222-8222-222222222222}');

-- only invitees answer
set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select is((select count(*) from public.plan_participants), 0::bigint, 'another group sees no participants');
select throws_ok(
  $$select public.respond_to_plan('c0000000-0000-4000-8000-000000000001', null, 'accepted')$$,
  '42501', 'not_invited', 'and cannot answer');
select throws_ok(
  $$select public.request_to_join_plan('c0000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')$$,
  'P0001', 'cannot_join', 'nor ask to join');
set local request.jwt.claims to '{"sub": "44444444-4444-4444-8444-444444444444", "role": "authenticated"}';
select throws_ok(
  $$select public.respond_to_plan('c0000000-0000-4000-8000-000000000001', null, 'accepted')$$,
  '42501', 'not_invited', 'a group mate who is not invited cannot answer');
select is((select count(*) from public.plan_participants), 2::bigint, 'but sees who takes part');

set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';
select lives_ok(
  $$select public.respond_to_plan('c0000000-0000-4000-8000-000000000001', null, 'accepted')$$,
  'the invitee says yes to the series');
select is(tests.notes('11111111-1111-4111-8111-111111111111', 'plan_response'), 1::bigint,
  'the owner is told');
select is((select count(*) from public.my_joined_plans()), 2::bigint, 'the plans are in the invitee''s calendar');
select throws_ok(
  $$select public.set_plan_participants('c0000000-0000-4000-8000-000000000001',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '{}')$$,
  '42501', 'not_plan_owner', 'only the owner changes who is invited');
-- Monday 14 does not suit: Tuesday 15, 19:00?
select lives_ok(
  $$select public.respond_to_plan('c0000000-0000-4000-8000-000000000001', '2026-12-14', 'proposed',
      '2026-12-15', '19:00')$$,
  'a proposal for one date');
select throws_ok(
  $$select public.accept_plan_proposal('c0000000-0000-4000-8000-000000000001',
      '22222222-2222-4222-8222-222222222222', '2026-12-14')$$,
  '42501', 'not_plan_owner', 'only the owner takes a proposal');

-- the owner takes it: that date moves, the proposer is in
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select public.accept_plan_proposal('c0000000-0000-4000-8000-000000000001',
  '22222222-2222-4222-8222-222222222222', '2026-12-14');
select results_eq(
  $$select on_date, start_time from public.plan_occurrences(
      '11111111-1111-4111-8111-111111111111', '2026-12-14', '2026-12-15')$$,
  $$values ('2026-12-15'::date, '19:00'::time)$$,
  'taking the proposal moves that date');
select is(
  (select status from public.plan_responses
    where user_id = '22222222-2222-4222-8222-222222222222' and on_date = '2026-12-14'),
  'accepted', 'and the proposer is in for it');

-- the owner changes the time of the series: everyone confirms again
update public.plans set start_time = '17:00' where id = 'c0000000-0000-4000-8000-000000000001';
select is(
  (select status from public.plan_participants
    where plan_id = 'c0000000-0000-4000-8000-000000000001' and user_id = '22222222-2222-4222-8222-222222222222'),
  'invited', 'a change by the owner opens the answers again');
select is(tests.notes('22222222-2222-4222-8222-222222222222', 'plan_changed'), 2::bigint,
  'and is told (the moved date and the new time)');

-- a cancelled date is told
insert into public.plan_skips (plan_id, on_date) values ('c0000000-0000-4000-8000-000000000001', '2026-12-21');
select is(tests.notes('22222222-2222-4222-8222-222222222222', 'plan_cancelled'), 1::bigint,
  'a cancelled date is told');

-- "Ich komm mit"
set local request.jwt.claims to '{"sub": "44444444-4444-4444-8444-444444444444", "role": "authenticated"}';
select public.request_to_join_plan('c0000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select is(tests.notes('11111111-1111-4111-8111-111111111111', 'plan_request'), 1::bigint,
  'asking to join tells the owner');
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select public.answer_join_request('c0000000-0000-4000-8000-000000000002', '44444444-4444-4444-8444-444444444444', true);
select is(
  (select status from public.plan_participants
    where plan_id = 'c0000000-0000-4000-8000-000000000002' and user_id = '44444444-4444-4444-8444-444444444444'),
  'accepted', 'the owner lets them in');

-- deleting the plan tells everyone
delete from public.plans where id = 'c0000000-0000-4000-8000-000000000002';
reset role;
select is(
  (select count(*) from public.notifications
    where event = 'plan_cancelled' and (data ->> 'deleted')::boolean
      and recipient_id in ('22222222-2222-4222-8222-222222222222', '44444444-4444-4444-8444-444444444444')),
  2::bigint, 'a deleted plan is told to everyone taking part');

select * from finish();
rollback;
