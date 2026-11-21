-- Push delivery: device registration (RLS), quiet hours, and what claim_push_deliveries
-- hands to the edge function (categories, bundling, quiet hours, missing devices).

begin;
create extension if not exists pgtap with schema extensions;

select plan(27);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'a1@test.local'),
  ('22222222-2222-4222-8222-222222222222', 'a2@test.local'),
  ('33333333-3333-4333-8333-333333333333', 'b@test.local'),
  ('44444444-4444-4444-8444-444444444444', 'c@test.local');

insert into public.profiles (id, display_name, color) values
  ('11111111-1111-4111-8111-111111111111', 'A1', 'person-1'),
  ('22222222-2222-4222-8222-222222222222', 'A2', 'person-2'),
  ('33333333-3333-4333-8333-333333333333', 'B', 'person-3'),
  ('44444444-4444-4444-8444-444444444444', 'C', 'person-4');

insert into public.groups (id, name) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Group A');
insert into public.group_members (group_id, user_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '44444444-4444-4444-8444-444444444444');
delete from public.notifications;

-- ---------------------------------------------------------------------------
-- Device registration
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';
select lives_ok(
  $$select public.register_push_subscription('https://push.example/a2', 'p', 'a', 'iPhone')$$,
  'users register their device');
select throws_ok(
  $$select public.register_push_subscription('http://insecure.example/x', 'p', 'a')$$,
  'P0001', 'invalid_endpoint', 'only https push endpoints are accepted');
select is((select count(*) from public.push_subscriptions), 1::bigint, 'users see their own devices');
select throws_ok(
  $$insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
    values ('11111111-1111-4111-8111-111111111111', 'https://push.example/x', 'p', 'a')$$,
  '42501', null, 'devices cannot be inserted directly');
select throws_ok($$select * from public.claim_push_deliveries()$$, '42501', null,
  'users cannot claim push deliveries');
select throws_ok($$select public.report_push_result(gen_random_uuid(), true, false)$$, '42501', null,
  'users cannot report push results');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select is((select count(*) from public.push_subscriptions), 0::bigint, 'devices of others are hidden');
select public.unregister_push_subscription('https://push.example/a2');
-- Same phone, now used by A1: the device moves to the last person who registered it.
select public.register_push_subscription('https://push.example/shared', 'p', 'a');
reset role;

select is(
  (select count(*) from public.push_subscriptions where endpoint = 'https://push.example/a2'),
  1::bigint, 'users cannot unregister devices of others');

set local role authenticated;
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';
select public.register_push_subscription('https://push.example/shared', 'p2', 'a2');
reset role;
select is(
  (select user_id from public.push_subscriptions where endpoint = 'https://push.example/shared'),
  '22222222-2222-4222-8222-222222222222'::uuid, 'a re-registered device belongs to the latest user');

-- ---------------------------------------------------------------------------
-- Quiet hours (time zone aware, window may span midnight)
-- ---------------------------------------------------------------------------
insert into public.notification_prefs (user_id, quiet_start, quiet_end, time_zone) values
  ('11111111-1111-4111-8111-111111111111', '22:00', '07:00', 'Europe/Berlin');
select ok(private.in_quiet_hours('11111111-1111-4111-8111-111111111111',
  '2026-11-21 23:30 Europe/Berlin'), '23:30 is inside 22:00–07:00');
select ok(private.in_quiet_hours('11111111-1111-4111-8111-111111111111',
  '2026-11-21 06:59 Europe/Berlin'), '06:59 is inside 22:00–07:00');
select ok(not private.in_quiet_hours('11111111-1111-4111-8111-111111111111',
  '2026-11-21 07:00 Europe/Berlin'), '07:00 is outside');
select ok(private.in_quiet_hours('44444444-4444-4444-8444-444444444444',
  '2026-11-21 23:30 Europe/Berlin'), 'without saved settings the default 22:00–07:00 applies');
update public.notification_prefs set quiet_hours_enabled = false
 where user_id = '11111111-1111-4111-8111-111111111111';
select ok(not private.in_quiet_hours('11111111-1111-4111-8111-111111111111',
  '2026-11-21 23:30 Europe/Berlin'), 'disabled quiet hours never block');

-- ---------------------------------------------------------------------------
-- Claiming deliveries
-- ---------------------------------------------------------------------------
-- A2: bundling on (default), quiet hours off, device registered above.
-- B: bundling off, quiet hours off, one device.
-- C: no device.
-- A1: quiet hours covering "now".
insert into public.notification_prefs (user_id, quiet_hours_enabled, bundle) values
  ('22222222-2222-4222-8222-222222222222', false, true),
  ('33333333-3333-4333-8333-333333333333', false, false);
insert into public.notification_prefs (user_id, preset) values
  ('44444444-4444-4444-8444-444444444444', 'standard');
update public.notification_prefs
   set quiet_hours_enabled = true,
       time_zone = 'UTC',
       quiet_start = ((now() at time zone 'UTC') - interval '1 hour')::time,
       quiet_end = ((now() at time zone 'UTC') + interval '1 hour')::time
 where user_id = '11111111-1111-4111-8111-111111111111';
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values
  ('33333333-3333-4333-8333-333333333333', 'https://push.example/b', 'p', 'a'),
  ('11111111-1111-4111-8111-111111111111', 'https://push.example/a1', 'p', 'a');

create temp table claimed as select * from public.claim_push_deliveries() limit 0;
grant select, insert on claimed to service_role;

insert into public.notifications (recipient_id, group_id, category, event, actor_id, target_type, target_id)
select r, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', c, 'comment',
       '44444444-4444-4444-8444-444444444444', 'feed_event', gen_random_uuid()
  from (values
    ('22222222-2222-4222-8222-222222222222'::uuid, 'comments_on_mine'),
    ('22222222-2222-4222-8222-222222222222'::uuid, 'mentions'),
    ('33333333-3333-4333-8333-333333333333'::uuid, 'replies'),
    ('33333333-3333-4333-8333-333333333333'::uuid, 'comments_on_mine'),
    ('44444444-4444-4444-8444-444444444444'::uuid, 'replies'),
    ('11111111-1111-4111-8111-111111111111'::uuid, 'replies'),
    ('22222222-2222-4222-8222-222222222222'::uuid, 'all_activity')
  ) as t (r, c);

set local role service_role;
insert into claimed select * from public.claim_push_deliveries();
reset role;

select is(
  (select jsonb_array_length(notifications) from claimed
    where user_id = '22222222-2222-4222-8222-222222222222'),
  2, 'bundling sends wanted notifications of one person as a single push');
select is(
  (select count(*) from claimed where user_id = '33333333-3333-4333-8333-333333333333'),
  2::bigint, 'without bundling every notification is its own push');
select is(
  (select count(*) from public.notifications
    where recipient_id = '22222222-2222-4222-8222-222222222222' and category = 'all_activity'
      and push_skipped),
  1::bigint, 'unwanted categories are skipped (all_activity is off in "standard")');
select is(
  (select push_skipped from public.notifications
    where recipient_id = '44444444-4444-4444-8444-444444444444'),
  true, 'people without a device are skipped');
select is(
  (select pushed_at from public.notifications
    where recipient_id = '11111111-1111-4111-8111-111111111111'),
  null, 'during quiet hours notifications wait');
select ok(
  (select subscriptions @> '[{"endpoint": "https://push.example/shared"}]'::jsonb from claimed
    where user_id = '22222222-2222-4222-8222-222222222222'),
  'the delivery carries the person''s devices');

select ok(
  (select notifications -> 0 ? 'commentId' from claimed
    where user_id = '22222222-2222-4222-8222-222222222222'),
  'push items carry the comment id for jumping to the comment');

-- A new notification for A2 right after a push waits for the bundle window …
insert into public.notifications (recipient_id, group_id, category, event, actor_id, target_type, target_id)
values ('22222222-2222-4222-8222-222222222222', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'replies', 'reply', '44444444-4444-4444-8444-444444444444', 'feed_event', gen_random_uuid());
set local role service_role;
select is(
  (select count(*) from public.claim_push_deliveries()), 0::bigint,
  'within the bundle window nothing new is pushed');
reset role;

-- … and goes out once the window has passed.
update public.push_state set last_push_at = now() - interval '4 minutes'
 where user_id = '22222222-2222-4222-8222-222222222222';
set local role service_role;
select is(
  (select count(*) from public.claim_push_deliveries()), 1::bigint,
  'after the bundle window the waiting notification is pushed');
reset role;

-- Bundling is opt-in; new notifications trigger delivery immediately.
select ok(not private.wants_bundling('44444444-4444-4444-8444-444444444444'),
  'without saved settings bundling is off');
select has_trigger('public', 'notifications', 'notifications_kick_push',
  'new notifications kick off push delivery right away');

-- Fewer calls: nothing pending outside quiet hours → the schedule stays silent.
update public.notifications set pushed_at = now() where pushed_at is null
  and recipient_id <> '11111111-1111-4111-8111-111111111111';
select ok(not private.push_work_pending(),
  'notifications held only by quiet hours do not wake the schedule');
insert into public.notifications (recipient_id, group_id, category, event, actor_id, target_type, target_id)
values ('33333333-3333-4333-8333-333333333333', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'replies', 'reply', '44444444-4444-4444-8444-444444444444', 'feed_event', gen_random_uuid());
select ok(private.push_work_pending(), 'a deliverable notification wakes the schedule');

select * from finish();
rollback;
