-- Training together (5c): the owner starts a plan date with people, an invitee joins; the
-- exercises are shared (add, remove, bring back, order), "nur für mich" stays personal,
-- done sets are never taken away; nobody writes into someone else's workout; other groups
-- see nothing.
--   a1 (owner), a2 (invited), a3 (group, not invited) share group A · b is in group B

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
insert into public.exercises (id, name, measure) values
  ('e0000000-0000-4000-8000-00000000000a', 'Test-Bank', 'weight_reps'),
  ('e0000000-0000-4000-8000-00000000000b', 'Test-Rudern', 'weight_reps'),
  ('e0000000-0000-4000-8000-00000000000c', 'Test-Curls', 'weight_reps');

-- a1 plans Monday 7 December, a2 is invited and says yes
insert into public.plans (id, user_id, kind, training_type_id, starts_on)
values ('c0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'training',
        (select id from public.training_types where name = 'Studio' and owner_id is null), '2026-12-07');
insert into public.plan_participants (plan_id, user_id, group_id, status) values
  ('c0000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'accepted');

create schema tests;
grant usage on schema tests to authenticated;
-- exercise names of a workout in order
create function tests.list(p_user uuid) returns text
language sql security definer set search_path = '' as $$
  select coalesce(string_agg(e.name, ',' order by i.position), '')
    from public.workout_items i
    join public.workouts w on w.id = i.workout_id and w.user_id = p_user and w.status = 'active'
    join public.exercises e on e.id = i.exercise_id
$$;
create function tests.workout(p_user uuid) returns uuid
language sql security definer set search_path = '' as $$
  select id from public.workouts where user_id = p_user and status = 'active'
$$;
grant execute on all functions in schema tests to authenticated;

-- the owner starts the date: a session starts (the trigger runs at commit; forced here)
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select public.start_workout((select id from public.training_types where name = 'Studio' and owner_id is null),
  null, null, 'c0000000-0000-4000-8000-000000000001', '2026-12-07');
set constraints all immediate;
select is((select count(*) from public.live_sessions where ended_at is null), 1::bigint,
  'starting a plan date with people starts a session');
insert into public.workout_items (id, workout_id, exercise_id, position) values
  ('d0000000-0000-4000-8000-00000000000a', tests.workout('11111111-1111-4111-8111-111111111111'),
   'e0000000-0000-4000-8000-00000000000a', 0);

-- the invitee joins and gets the list
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';
select is((select count(*) from public.live_today('2026-12-07') where session_id is not null), 1::bigint,
  'the invitee sees that the date is being trained');
select lives_ok(
  $$select public.live_start('c0000000-0000-4000-8000-000000000001', '2026-12-07')$$,
  'the invitee joins');
select is(tests.list('22222222-2222-4222-8222-222222222222'), 'Test-Bank', 'and gets the shared list');

-- adding: for all, or only for me
insert into public.workout_items (id, workout_id, exercise_id, position) values
  ('d0000000-0000-4000-8000-00000000000b', tests.workout('22222222-2222-4222-8222-222222222222'),
   'e0000000-0000-4000-8000-00000000000b', 1);
select is(tests.list('11111111-1111-4111-8111-111111111111'), 'Test-Bank,Test-Rudern',
  'an exercise added by one is added for all');
select public.live_keep_private('d0000000-0000-4000-8000-00000000000c');
insert into public.workout_items (id, workout_id, exercise_id, position) values
  ('d0000000-0000-4000-8000-00000000000c', tests.workout('22222222-2222-4222-8222-222222222222'),
   'e0000000-0000-4000-8000-00000000000c', 2);
select is(tests.list('11111111-1111-4111-8111-111111111111'), 'Test-Bank,Test-Rudern',
  '"nur für mich" stays personal');
select is(tests.list('22222222-2222-4222-8222-222222222222'), 'Test-Bank,Test-Rudern,Test-Curls',
  'but is in my own list');
select throws_ok(
  $$insert into public.workout_items (workout_id, exercise_id, position)
    values (tests.workout('11111111-1111-4111-8111-111111111111'), 'e0000000-0000-4000-8000-00000000000c', 5)$$,
  '42501', null, 'nobody writes into someone else''s workout');
-- a2 has done a set of Bank
insert into public.workout_sets (item_id, position, weight_kg, reps, completed_at)
select i.id, 1, 60, 10, now() from public.workout_items i
 where i.workout_id = tests.workout('22222222-2222-4222-8222-222222222222')
   and i.exercise_id = 'e0000000-0000-4000-8000-00000000000a';

-- the order of one is the order of all; personal exercises keep their place
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select public.set_item_positions(tests.workout('11111111-1111-4111-8111-111111111111'),
  array[(select id from public.workout_items where workout_id = tests.workout('11111111-1111-4111-8111-111111111111') and exercise_id = 'e0000000-0000-4000-8000-00000000000b'),
        'd0000000-0000-4000-8000-00000000000a'::uuid]);
select is(tests.list('22222222-2222-4222-8222-222222222222'), 'Test-Rudern,Test-Bank,Test-Curls',
  'moving exercises moves them for all');
select is(
  (select count(*) from public.live_peer_sets(tests.workout('11111111-1111-4111-8111-111111111111'))
    where jsonb_array_length(sets) = 1),
  1::bigint, 'the others'' done sets show at the shared exercise');

-- removing: gone for all, unless someone has done sets in it; bringing back is for all
delete from public.workout_items where id = 'd0000000-0000-4000-8000-00000000000a';
select is(tests.list('22222222-2222-4222-8222-222222222222'), 'Test-Rudern,Test-Bank,Test-Curls',
  'an exercise with done sets stays with that person');
select is(tests.list('11111111-1111-4111-8111-111111111111'), 'Test-Rudern', 'and goes for the one who removed it');
create temp table removed on commit drop as
  select * from public.workout_items
   where workout_id = tests.workout('11111111-1111-4111-8111-111111111111');
reset role;
grant select on removed to authenticated;
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
delete from public.workout_items where workout_id = tests.workout('11111111-1111-4111-8111-111111111111');
select is(tests.list('22222222-2222-4222-8222-222222222222'), 'Test-Bank,Test-Curls',
  'an exercise without done sets goes for all');
insert into public.workout_items (id, workout_id, exercise_id, position)
select id, workout_id, exercise_id, position from removed;
select is(tests.list('22222222-2222-4222-8222-222222222222'), 'Test-Bank,Test-Curls,Test-Rudern',
  'bringing it back brings it back for all');

-- people not invited, other groups
set local request.jwt.claims to '{"sub": "44444444-4444-4444-8444-444444444444", "role": "authenticated"}';
select throws_ok(
  $$select public.live_start('c0000000-0000-4000-8000-000000000001', '2026-12-07')$$,
  '42501', 'not_invited', 'someone not invited cannot join');
select is((select count(*) from public.live_today('2026-12-07')), 0::bigint, 'and is not offered it');
select is((select count(*) from public.live_sessions), 1::bigint, 'but the group sees the session');
set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select is((select count(*) from public.live_sessions), 0::bigint, 'another group sees no session');
select is((select count(*) from public.live_members), 0::bigint, 'nor who trains');
select throws_ok(
  $$select public.live_start('c0000000-0000-4000-8000-000000000001', '2026-12-07')$$,
  '42501', 'not_invited', 'nor can join');

-- the session ends when both are done
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';
select public.finish_workout(tests.workout('22222222-2222-4222-8222-222222222222'));
reset role;
select is((select count(*) from public.live_sessions where ended_at is null), 1::bigint,
  'the session runs while someone still trains');
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select public.finish_workout(tests.workout('11111111-1111-4111-8111-111111111111'));
reset role;
select is((select count(*) from public.live_sessions where ended_at is null), 0::bigint,
  'and ends when everyone is done');

select * from finish();
rollback;
