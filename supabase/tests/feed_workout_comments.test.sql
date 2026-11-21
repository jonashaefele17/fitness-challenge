-- Comments and reactions on a workout's exercises and sets: group mates may, the owner is
-- told, the day card moves up under "Zuletzt aktiv"; other groups cannot.
--   a1, a2 share group A · b is in group B

begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'a1@test.local'),
  ('22222222-2222-4222-8222-222222222222', 'a2@test.local'),
  ('33333333-3333-4333-8333-333333333333', 'b@test.local');
insert into public.profiles (id, display_name, color) values
  ('11111111-1111-4111-8111-111111111111', 'A1', 'person-1'),
  ('22222222-2222-4222-8222-222222222222', 'A2', 'person-2'),
  ('33333333-3333-4333-8333-333333333333', 'B', 'person-3');
insert into public.groups (id, name) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'A'), ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'B');
insert into public.group_members (group_id, user_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '33333333-3333-4333-8333-333333333333');

insert into public.exercises (id, name, measure) values
  ('e0000000-0000-4000-8000-000000000001', 'Test-Drücken', 'weight_reps');
insert into public.workouts (id, user_id, training_type_id, status, started_at, ended_at)
values ('f0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
        (select id from public.training_types where name = 'Studio' and owner_id is null),
        'finished', now() - interval '3 days', now() - interval '3 days' + interval '1 hour');
insert into public.workout_items (id, workout_id, exercise_id, position)
values ('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001',
        'e0000000-0000-4000-8000-000000000001', 0);
-- an older card that is "newer" by activity before the comment
update public.feed_days set last_activity_at = now() - interval '1 day';

set local role authenticated;
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';
select lives_ok(
  $$select public.post_comment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'workout_item',
      'a0000000-0000-4000-8000-000000000001', 'Sauber!', 1)$$,
  'a group mate comments on a set');
select lives_ok(
  $$select public.set_reaction('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'workout_item',
      'a0000000-0000-4000-8000-000000000001', 1, 'strong')$$,
  'and reacts to it');
reset role;

select is(
  (select count(*) from public.notifications
    where recipient_id = '11111111-1111-4111-8111-111111111111'
      and category = 'comments_on_mine' and target_index = 1),
  1::bigint, 'the owner is told about the comment on the set');
select is(
  (select count(*) from public.notifications
    where recipient_id = '11111111-1111-4111-8111-111111111111' and event = 'reaction'),
  1::bigint, 'and about the reaction');
select ok(
  (select last_activity_at > now() - interval '1 minute' from public.feed_days
    where kind = 'day' and actor_id = '11111111-1111-4111-8111-111111111111'
      and day = private.local_day('11111111-1111-4111-8111-111111111111', now() - interval '3 days')),
  'the workout''s day card counts as active again');

set local role authenticated;
set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select throws_ok(
  $$select public.post_comment('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'workout_item',
      'a0000000-0000-4000-8000-000000000001', 'Hallo', 1)$$,
  'P0001', 'target_not_found', 'another group cannot comment on it');
select is(
  (select count(*) from public.comments), 0::bigint, 'nor read the comments');
reset role;

select * from finish();
rollback;
