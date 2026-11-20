-- RLS and engine tests for the social cores: feed events, comments, reactions, read markers,
-- notification settings and notifications.
--
-- Cast:
--   a1  admin of A          a2  member of A
--   b1  admin of B          c   member of A and B
--   d   member of A with preset "all" (receives all_activity)
--   x   joins A during the test

begin;
create extension if not exists pgtap with schema extensions;

select plan(47);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
create schema tests;
grant usage on schema tests to anon, authenticated;

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'a1@test.local'),
  ('22222222-2222-4222-8222-222222222222', 'a2@test.local'),
  ('33333333-3333-4333-8333-333333333333', 'b1@test.local'),
  ('44444444-4444-4444-8444-444444444444', 'c@test.local'),
  ('77777777-7777-4777-8777-777777777777', 'd@test.local'),
  ('88888888-8888-4888-8888-888888888888', 'x@test.local');

insert into public.profiles (id, display_name, color) values
  ('11111111-1111-4111-8111-111111111111', 'A1', 'person-1'),
  ('22222222-2222-4222-8222-222222222222', 'A2', 'person-2'),
  ('33333333-3333-4333-8333-333333333333', 'B1', 'person-1'),
  ('44444444-4444-4444-8444-444444444444', 'C', 'person-3'),
  ('77777777-7777-4777-8777-777777777777', 'D', 'person-4'),
  ('88888888-8888-4888-8888-888888888888', 'X', 'person-5');

insert into public.groups (id, name) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Group A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Group B');

insert into public.notification_prefs (user_id, preset)
values ('77777777-7777-4777-8777-777777777777', 'all');

insert into public.group_members (group_id, user_id, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'admin'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'member'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '44444444-4444-4444-8444-444444444444', 'member'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '77777777-7777-4777-8777-777777777777', 'member'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '33333333-3333-4333-8333-333333333333', 'admin'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '44444444-4444-4444-8444-444444444444', 'member');

-- Remove notifications produced while setting up memberships.
delete from public.notifications;

-- Feed event ids (created by the membership trigger), readable by every test role.
create table tests.ev as
select fe.id, fe.group_id, fe.actor_id from public.feed_events fe;
grant select on tests.ev to anon, authenticated;

create function tests.ev(p_group uuid, p_actor uuid) returns uuid
language sql stable as $$
  select id from tests.ev where group_id = p_group and actor_id = p_actor
$$;
grant execute on function tests.ev(uuid, uuid) to anon, authenticated;

-- Shorthands
create function tests.a_event() returns uuid language sql stable as $$
  select tests.ev('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111')
$$;
grant execute on function tests.a_event() to anon, authenticated;

create function tests.notif_count(p_user uuid, p_category text) returns bigint
language sql stable security definer set search_path = '' as $$
  select count(*) from public.notifications
  where recipient_id = p_user and (p_category is null or category = p_category)
$$;
grant execute on function tests.notif_count(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Feed events
-- ---------------------------------------------------------------------------
select is(
  (select count(*) from public.feed_events where group_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  4::bigint, 'joining creates a member_joined event per membership');

set local role anon;
set local request.jwt.claims to '{"role": "anon"}';
select throws_ok('select * from public.feed_events', '42501', null, 'anon cannot read the feed');
select throws_ok(
  $$select public.post_comment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'feed_event', tests.a_event(), 'hi')$$,
  '42501', null, 'anon cannot comment');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';
select is((select count(*) from public.feed_events), 4::bigint, 'member of A sees only the feed of A');
select throws_ok(
  $$insert into public.feed_events (group_id, actor_id, type) values
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'member_joined')$$,
  '42501', null, 'feed events cannot be written directly');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select is((select count(*) from public.feed_events), 2::bigint, 'member of B sees only the feed of B');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "44444444-4444-4444-8444-444444444444", "role": "authenticated"}';
select is((select count(*) from public.feed_events), 6::bigint, 'member of A and B sees both feeds');
reset role;

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';

select lives_ok(
  $$select public.post_comment(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'feed_event', tests.a_event(), '  Willkommen! @C  ',
      p_mentions => array['44444444-4444-4444-8444-444444444444',
                          '33333333-3333-4333-8333-333333333333']::uuid[])$$,
  'member comments on an object of their group');
select is(
  (select body from public.comments where author_id = '22222222-2222-4222-8222-222222222222'),
  'Willkommen! @C', 'comment body is trimmed');
select throws_ok(
  $$insert into public.comments (group_id, target_type, target_id, author_id, body) values
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'feed_event', tests.a_event(),
     '22222222-2222-4222-8222-222222222222', 'direct')$$,
  '42501', null, 'comments can only be created through post_comment');
select is(
  (select count(*) from public.comment_mentions), 1::bigint,
  'only group members can be mentioned');

-- Another root comment on a2's own join event (used for the invalid-parent test).
select public.post_comment(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'feed_event',
  tests.ev('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222'),
  'Ich bin auch da');

update public.comments set body = 'Willkommen im Team! @C'
 where author_id = '22222222-2222-4222-8222-222222222222' and body like 'Willkommen%';
select isnt(
  (select edited_at from public.comments where body = 'Willkommen im Team! @C'),
  null, 'authors can edit their comments (edited_at is set)');
select throws_ok(
  $$update public.comments set author_id = '11111111-1111-4111-8111-111111111111'$$,
  '42501', null, 'the author of a comment cannot be changed');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select throws_ok(
  $$select public.post_comment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'feed_event', tests.a_event(), 'x')$$,
  'P0001', 'target_not_found', 'non-members cannot comment on another group');
select is((select count(*) from public.comments), 0::bigint, 'non-members see no comments of A');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "44444444-4444-4444-8444-444444444444", "role": "authenticated"}';
select throws_ok(
  $$select public.post_comment('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'feed_event', tests.a_event(), 'x')$$,
  'P0001', 'target_not_found', 'an object of A cannot be commented in the context of B');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
update public.comments set body = 'hacked' where author_id = '22222222-2222-4222-8222-222222222222';
select is(
  (select count(*) from public.comments where body = 'hacked'), 0::bigint,
  'others cannot edit a comment');
reset role;

-- Notifications for the first comment
select is(tests.notif_count('11111111-1111-4111-8111-111111111111', 'comments_on_mine'), 1::bigint,
  'owner is notified about a comment on their object');
select is(tests.notif_count('44444444-4444-4444-8444-444444444444', 'mentions'), 1::bigint,
  'mentioned member is notified');
select is(tests.notif_count('33333333-3333-4333-8333-333333333333', null), 0::bigint,
  'a mentioned non-member is not notified');
select is(tests.notif_count('22222222-2222-4222-8222-222222222222', null), 0::bigint,
  'the author is never notified about their own comment');
select is(tests.notif_count('77777777-7777-4777-8777-777777777777', 'all_activity'), 2::bigint,
  'members with preset "all" get all_activity');

-- Replies
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select lives_ok(
  $$select public.post_comment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'feed_event', tests.a_event(), 'Danke!',
      p_parent_id => (select id from public.comments where body like 'Willkommen im Team%'))$$,
  'owner replies');
select throws_ok(
  $$select public.post_comment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'feed_event', tests.a_event(), 'x',
      p_parent_id => (select id from public.comments where body = 'Ich bin auch da'))$$,
  'P0001', 'invalid_parent', 'a reply must belong to the same object');
reset role;

select is(tests.notif_count('22222222-2222-4222-8222-222222222222', 'replies'), 1::bigint,
  'thread participants are notified about replies');

set local role authenticated;
set local request.jwt.claims to '{"sub": "44444444-4444-4444-8444-444444444444", "role": "authenticated"}';
select public.post_comment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'feed_event', tests.a_event(), 'Stark',
  p_parent_id => (select id from public.comments where body = 'Danke!'));
select is(
  (select parent_id from public.comments where body = 'Stark'),
  (select id from public.comments where body like 'Willkommen im Team%'),
  'replies to replies attach to the root comment');
reset role;

-- Read markers and comment stats
update public.read_markers set last_read_at = last_read_at - interval '1 hour'
 where user_id = '11111111-1111-4111-8111-111111111111';

set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select results_eq(
  $$select total, unread from public.comment_stats(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'feed_event', array[tests.a_event()])$$,
  $$values (3::bigint, 2::bigint)$$,
  'comment_stats counts total and unread comments by others');
select public.mark_thread_read('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'feed_event', tests.a_event());
select results_eq(
  $$select unread from public.comment_stats(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'feed_event', array[tests.a_event()])$$,
  $$values (0::bigint)$$,
  'reading a thread clears its unread count');
select is(
  (select count(*) from public.notifications where read_at is null and comment_id is not null),
  0::bigint, 'reading a thread marks its notifications as read');
select is(
  (select count(*) from public.read_markers where user_id <> '11111111-1111-4111-8111-111111111111'),
  0::bigint, 'read markers of others are not visible');
reset role;

-- ---------------------------------------------------------------------------
-- Reactions
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "44444444-4444-4444-8444-444444444444", "role": "authenticated"}';
select lives_ok(
  $$insert into public.reactions (group_id, target_type, target_id)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'feed_event', tests.a_event())$$,
  'member reacts to an object of their group');
delete from public.reactions where user_id = '44444444-4444-4444-8444-444444444444';
insert into public.reactions (group_id, target_type, target_id)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'feed_event', tests.a_event());
select throws_ok(
  $$insert into public.reactions (group_id, target_type, target_id, user_id)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'feed_event', tests.a_event(),
            '11111111-1111-4111-8111-111111111111')$$,
  '42501', null, 'nobody can react in someone else''s name');
select throws_ok(
  $$insert into public.reactions (group_id, target_type, target_id)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'feed_event', tests.a_event())$$,
  '42501', null, 'an object of A cannot get reactions in the context of B');
reset role;

select is(tests.notif_count('11111111-1111-4111-8111-111111111111', 'reactions'), 1::bigint,
  'owner is notified once, even if the reaction is toggled');

set local role authenticated;
set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select throws_ok(
  $$insert into public.reactions (group_id, target_type, target_id)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'feed_event', tests.a_event())$$,
  '42501', null, 'non-members cannot react');
select is((select count(*) from public.reactions), 0::bigint, 'non-members see no reactions of A');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';
select is((select count(*) from public.reactions), 1::bigint, 'members see the reactions of their group');
delete from public.reactions;
select is((select count(*) from public.reactions), 1::bigint, 'members cannot remove others'' reactions');

-- ---------------------------------------------------------------------------
-- Notifications and settings
-- ---------------------------------------------------------------------------
select is(
  (select count(*) from public.notifications where recipient_id <> '22222222-2222-4222-8222-222222222222'),
  0::bigint, 'users only see their own notifications');
update public.notifications set read_at = now()
 where recipient_id = '11111111-1111-4111-8111-111111111111';

select lives_ok(
  $$insert into public.notification_prefs (preset) values ('important')$$,
  'users store their own notification settings');
select throws_ok(
  $$insert into public.notification_prefs (user_id) values ('11111111-1111-4111-8111-111111111111')$$,
  '42501', null, 'users cannot write settings for others');
select throws_ok(
  $$update public.notification_prefs set preset = 'loud'$$,
  '23514', null, 'unknown presets are rejected');
-- Override: a2 wants all activity although the preset is "important".
insert into public.notification_category_prefs (category, enabled) values ('all_activity', true);
reset role;

select is(
  (select count(*) from public.notifications
    where recipient_id = '11111111-1111-4111-8111-111111111111' and read_at is not null
      and category <> 'comments_on_mine' and category <> 'replies'),
  0::bigint, 'others cannot mark someone''s notifications as read');

set local role authenticated;
set local request.jwt.claims to '{"sub": "44444444-4444-4444-8444-444444444444", "role": "authenticated"}';
select public.post_comment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'feed_event',
  tests.ev('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '77777777-7777-4777-8777-777777777777'), 'Hallo D');
select public.mark_all_notifications_read();
select is(
  (select count(*) from public.notifications where read_at is null), 0::bigint,
  'mark_all_notifications_read clears the bell');
reset role;

select is(
  (select count(*) from public.notifications
    where recipient_id = '22222222-2222-4222-8222-222222222222' and category = 'all_activity'),
  1::bigint, 'a category override beats the preset');
select is(tests.notif_count('77777777-7777-4777-8777-777777777777', 'comments_on_mine'), 1::bigint,
  'owner of the commented object is notified');

-- A new member joins: feed event + all_activity notifications.
insert into public.group_members (group_id, user_id)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '88888888-8888-4888-8888-888888888888');
select is(
  (select count(*) from public.notifications where event = 'member_joined'
     and actor_id = '88888888-8888-4888-8888-888888888888'),
  2::bigint, 'joining notifies the members who want all activity (D by preset, A2 by override)');

select * from finish();
rollback;
