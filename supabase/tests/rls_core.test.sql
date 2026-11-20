-- RLS tests for the core tables (profiles, groups, group_members, invites)
-- and the invite RPCs. Run with `npm run test:rls` (needs the local stack).
--
-- Cast:
--   a1  admin of group A
--   a2  member of group A
--   b1  admin of group B
--   c   member of A and B
--   x   signed in, no profile yet (redeems invites during the test)
--   y   signed in, no profile (redeems the super-admin invite)

begin;
create extension if not exists pgtap with schema extensions;

select plan(49);

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres, bypassing RLS)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'a1@test.local', '{}'),
  ('22222222-2222-4222-8222-222222222222', 'a2@test.local', '{}'),
  ('33333333-3333-4333-8333-333333333333', 'b1@test.local', '{}'),
  ('44444444-4444-4444-8444-444444444444', 'c@test.local', '{}'),
  ('55555555-5555-4555-8555-555555555555', 'x@test.local', '{"avatar_url": "https://example.test/x.png"}'),
  ('66666666-6666-4666-8666-666666666666', 'y@test.local', '{}');

insert into public.profiles (id, display_name, color) values
  ('11111111-1111-4111-8111-111111111111', 'A1', 'person-1'),
  ('22222222-2222-4222-8222-222222222222', 'A2', 'person-2'),
  ('33333333-3333-4333-8333-333333333333', 'B1', 'person-1'),
  ('44444444-4444-4444-8444-444444444444', 'C', 'person-3');

insert into public.groups (id, name) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Group A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Group B');

insert into public.group_members (group_id, user_id, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'admin'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'member'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '44444444-4444-4444-8444-444444444444', 'member'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '33333333-3333-4333-8333-333333333333', 'admin'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '44444444-4444-4444-8444-444444444444', 'member');

insert into public.invites
  (group_id, code_hash, role, grants_super_admin, max_uses, used_count, expires_at, revoked_at)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', private.hash_invite_code('TEST-A'), 'member', false, 5, 0, null, null),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', private.hash_invite_code('TEST-B'), 'member', false, 5, 0, null, null),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', private.hash_invite_code('TEST-EXPIRED'), 'member', false, 5, 0, now() - interval '1 day', null),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', private.hash_invite_code('TEST-REVOKED'), 'member', false, 5, 0, null, now()),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', private.hash_invite_code('TEST-USED'), 'member', false, 1, 1, null, null),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', private.hash_invite_code('TEST-SUPER'), 'admin', true, 1, 0, null, null);

-- ---------------------------------------------------------------------------
-- Anonymous: no access at all
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select throws_ok('select * from public.profiles', '42501', null, 'anon cannot read profiles');
select throws_ok('select * from public.groups', '42501', null, 'anon cannot read groups');
select throws_ok('select * from public.group_members', '42501', null, 'anon cannot read memberships');
select throws_ok('select id from public.invites', '42501', null, 'anon cannot read invites');
select throws_ok($$select public.redeem_invite('TEST-A', 'Anon')$$, '42501', null,
  'anon cannot redeem invites');

reset role;

-- ---------------------------------------------------------------------------
-- Signed in without profile: sees nothing
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "55555555-5555-4555-8555-555555555555", "role": "authenticated"}';

select is((select count(*) from public.groups), 0::bigint, 'user without membership sees no groups');
select is((select count(*) from public.profiles), 0::bigint, 'user without membership sees no profiles');
select is((select count(*) from public.group_members), 0::bigint, 'user without membership sees no memberships');

reset role;

-- ---------------------------------------------------------------------------
-- Member of A: sees A, nothing of B
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';

select results_eq(
  'select id from public.groups order by id',
  $$values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid)$$,
  'member of A sees only group A');
select results_eq(
  'select display_name from public.profiles order by display_name',
  $$values ('A1'), ('A2'), ('C')$$,
  'member of A sees profiles of A, not B1');
select is(
  (select count(*) from public.group_members where group_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  0::bigint, 'member of A sees no memberships of B');
select is((select count(*) from public.invites), 0::bigint, 'non-admin sees no invites');

-- Own profile: allowed columns only.
update public.profiles set display_name = 'A2 renamed' where id = '22222222-2222-4222-8222-222222222222';
select is(
  (select display_name from public.profiles where id = '22222222-2222-4222-8222-222222222222'),
  'A2 renamed', 'user can rename own profile');
select throws_ok(
  $$update public.profiles set is_super_admin = true where id = '22222222-2222-4222-8222-222222222222'$$,
  '42501', null, 'user cannot make themselves super admin');
select throws_ok(
  $$update public.profiles set color = 'person-8' where id = '22222222-2222-4222-8222-222222222222'$$,
  '42501', null, 'user cannot change their colour directly');

-- Other people's data: silently filtered.
update public.profiles set display_name = 'hacked' where id = '11111111-1111-4111-8111-111111111111';
select is(
  (select display_name from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
  'A1', 'user cannot rename someone else');
update public.group_members set role = 'admin'
  where user_id = '22222222-2222-4222-8222-222222222222';
select is(
  (select role::text from public.group_members
    where user_id = '22222222-2222-4222-8222-222222222222'),
  'member', 'member cannot promote themselves');
delete from public.group_members where user_id = '11111111-1111-4111-8111-111111111111';
select is(
  (select count(*) from public.group_members where user_id = '11111111-1111-4111-8111-111111111111'),
  1::bigint, 'member cannot remove others');
update public.groups set name = 'hacked' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select is(
  (select name from public.groups where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'Group A', 'member cannot rename the group');

-- No direct inserts anywhere.
select throws_ok(
  $$insert into public.group_members (group_id, user_id) values
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222')$$,
  '42501', null, 'user cannot add themselves to another group');
select throws_ok(
  $$insert into public.groups (name) values ('Mine')$$,
  '42501', null, 'user cannot create groups directly');
select throws_ok(
  $$insert into public.invites (group_id, code_hash) values
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat('a', 64))$$,
  '42501', null, 'user cannot create invites directly');

reset role;

-- ---------------------------------------------------------------------------
-- Admin of A: manages A, cannot touch B
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

select is(
  (select count(*) from public.invites where group_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  4::bigint, 'admin of A sees the invites of A');
select is(
  (select count(*) from public.invites where group_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  0::bigint, 'admin of A sees no invites of B');
select throws_ok('select code_hash from public.invites', '42501', null,
  'invite code hashes are never readable');

update public.groups set name = 'Group A+' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select is(
  (select name from public.groups where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'Group A+', 'admin can rename own group');

update public.groups set name = 'hacked' where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
delete from public.group_members where group_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

reset role;

select is(
  (select name from public.groups where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  'Group B', 'admin of A cannot rename group B');
select is(
  (select count(*) from public.group_members where group_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  2::bigint, 'admin of A cannot remove members of B');

-- ---------------------------------------------------------------------------
-- Admin of B: sees nothing of A
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';

select results_eq(
  'select id from public.groups order by id',
  $$values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid)$$,
  'admin of B sees only group B');
select results_eq(
  'select display_name from public.profiles order by display_name',
  $$values ('B1'), ('C')$$,
  'admin of B sees only profiles of B (C is shared)');

reset role;

-- ---------------------------------------------------------------------------
-- Member of A and B: sees both
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "44444444-4444-4444-8444-444444444444", "role": "authenticated"}';

select is((select count(*) from public.groups), 2::bigint, 'member of A and B sees both groups');
select is((select count(*) from public.profiles), 4::bigint, 'member of A and B sees everyone in both');

reset role;

-- ---------------------------------------------------------------------------
-- Invite RPCs
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "55555555-5555-4555-8555-555555555555", "role": "authenticated"}';

select results_eq(
  $$select group_name from public.check_invite('test-b')$$,
  $$values ('Group B')$$,
  'check_invite finds a valid code, case-insensitive');
select is((select count(*) from public.check_invite('TEST-EXPIRED')), 0::bigint,
  'check_invite hides expired codes');
select throws_ok($$select public.redeem_invite('NOPE', 'X')$$, 'P0001', 'invite_invalid',
  'unknown code is rejected');
select throws_ok($$select public.redeem_invite('TEST-EXPIRED', 'X')$$, 'P0001', 'invite_invalid',
  'expired code is rejected');
select throws_ok($$select public.redeem_invite('TEST-REVOKED', 'X')$$, 'P0001', 'invite_invalid',
  'revoked code is rejected');
select throws_ok($$select public.redeem_invite('TEST-USED', 'X')$$, 'P0001', 'invite_invalid',
  'used-up code is rejected');
select throws_ok($$select public.redeem_invite('TEST-B', '  ')$$, 'P0001', 'display_name_required',
  'first redemption needs a display name');

select is(
  public.redeem_invite('test b', ' Xaver ', 'McFit'),
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
  'valid code joins its group (spaces and case ignored)');
select results_eq(
  $$select display_name, home_gym, color, avatar_url, is_super_admin from public.profiles
    where id = '55555555-5555-4555-8555-555555555555'$$,
  $$values ('Xaver'::text, 'McFit'::text, 'person-2'::text, 'https://example.test/x.png'::text, false)$$,
  'profile created with trimmed name, free colour and Google avatar');
select results_eq(
  'select id from public.groups order by id',
  $$values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid)$$,
  'new member sees exactly the invited group');
select throws_ok($$select public.redeem_invite('TEST-B')$$, 'P0001', 'already_member',
  'redeeming for a group you are already in is rejected');

select is(
  public.redeem_invite('TEST-A'),
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
  'existing user joins a second group without profile data');
select is(
  (select display_name from public.profiles where id = '55555555-5555-4555-8555-555555555555'),
  'Xaver', 'second redemption keeps the profile');

reset role;

select is(
  (select used_count from public.invites where code_hash = private.hash_invite_code('TEST-B')),
  1, 'redemption counts a use');

set local role authenticated;
set local request.jwt.claims to '{"sub": "66666666-6666-4666-8666-666666666666", "role": "authenticated"}';

select lives_ok($$select public.redeem_invite('TEST-SUPER', 'Founder')$$,
  'super-admin invite can be redeemed');
select results_eq(
  $$select is_super_admin from public.profiles where id = '66666666-6666-4666-8666-666666666666'$$,
  $$values (true)$$,
  'super-admin invite sets the flag');
select results_eq(
  $$select role::text from public.group_members where user_id = '66666666-6666-4666-8666-666666666666'$$,
  $$values ('admin')$$,
  'invite role becomes the membership role');

reset role;

select * from finish();
rollback;
