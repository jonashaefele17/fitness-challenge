-- discard_goal: undo right after creating removes the goal; only the owner, only shortly
-- after creating.
--   a1 has the goals · a2 is in the same group

begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'a1@test.local'),
  ('22222222-2222-4222-8222-222222222222', 'a2@test.local');
insert into public.profiles (id, display_name, color) values
  ('11111111-1111-4111-8111-111111111111', 'A1', 'person-1'),
  ('22222222-2222-4222-8222-222222222222', 'A2', 'person-2');
insert into public.groups (id, name) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'A');
insert into public.group_members (group_id, user_id, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'member'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'admin');

set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

select public.create_goal('90000000-0000-4000-8000-000000000001', 'body_weight',
  '2026-12-01', '2026-12-31', 85, 83, 80, 'shared');
select public.create_goal('90000000-0000-4000-8000-000000000002', 'body_weight',
  '2026-12-01', '2026-12-31', 85, null, 80);

set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';
select throws_ok(
  $$select public.discard_goal('90000000-0000-4000-8000-000000000001')$$,
  '42501', 'goal_not_found', 'another person (even the group admin) cannot discard my goal');

set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select lives_ok(
  $$select public.discard_goal('90000000-0000-4000-8000-000000000001')$$,
  'I can discard a goal I just created');
select results_eq(
  $$select id from public.goals$$,
  $$values ('90000000-0000-4000-8000-000000000002'::uuid)$$, 'only that goal is gone');

reset role;
select results_eq(
  $$select count(*) from public.goal_versions
     where goal_id = '90000000-0000-4000-8000-000000000001'$$,
  $$values (0::bigint)$$, 'its versions are gone, too');
update public.goals set created_at = now() - interval '11 minutes'
 where id = '90000000-0000-4000-8000-000000000002';
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

select throws_ok(
  $$select public.discard_goal('90000000-0000-4000-8000-000000000002')$$,
  '22023', 'goal_too_old_to_discard', 'an older goal is archived, not discarded');
select results_eq(
  $$select count(*) from public.goals$$, $$values (1::bigint)$$, 'and it is still there');

select * from finish();
rollback;
