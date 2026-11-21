-- Feed day cards: finished workouts reach the day card of their person in each group;
-- logged late they notify nobody; other groups see nothing; reactions are one per person.
--   a1, a2 share group A · b is in group B

begin;
create extension if not exists pgtap with schema extensions;

select plan(19);

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
-- a2 wants every activity
insert into public.notification_prefs (user_id, preset) values
  ('22222222-2222-4222-8222-222222222222', 'all');
-- joining created member_joined cards; start clean
delete from public.feed_days;

create schema tests;
grant usage on schema tests to authenticated;
create function tests.run() returns uuid language sql stable as $$
  select id from public.training_types where name = 'Laufen' and owner_id is null
$$;
grant execute on function tests.run() to authenticated;

-- a1 logs a run right after it (counts as live)
insert into public.workouts (id, user_id, training_type_id, status, started_at, ended_at, duration_seconds)
values ('f0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', tests.run(),
        'finished', now() - interval '50 minutes', now() - interval '5 minutes', 2700);

select is((select count(*) from public.feed_events where type = 'workout_finished'), 1::bigint,
  'a finished workout becomes a feed event');
select is((select count(*) from public.feed_days), 1::bigint, 'on one day card');
select is((select data ->> 'late' from public.feed_events where type = 'workout_finished'), 'false',
  'logged right away it is not late');
select is(
  (select count(*) from public.notifications
    where event = 'workout_finished' and recipient_id = '22222222-2222-4222-8222-222222222222'),
  1::bigint, 'a group mate who wants all activity is told');
select is(
  (select count(*) from public.notifications
    where event = 'workout_finished' and recipient_id = '11111111-1111-4111-8111-111111111111'),
  0::bigint, 'the person who trained is not');

-- a second workout the same day joins the same card
insert into public.workouts (id, user_id, training_type_id, status, started_at, ended_at, duration_seconds)
values ('f0000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', tests.run(),
        'finished', now() - interval '20 minutes', now() - interval '10 minutes', 600);
select is((select count(*) from public.feed_days), 1::bigint, 'a second workout that day joins the card');

-- logged a few days later: on its own day, no notification
insert into public.workouts (id, user_id, training_type_id, status, started_at, ended_at, duration_seconds)
values ('f0000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', tests.run(),
        'finished', now() - interval '3 days', now() - interval '3 days' + interval '30 minutes', 1800);
select is((select count(*) from public.feed_days), 2::bigint, 'a late workout lands on its own day');
select is(
  (select data ->> 'late' from public.feed_events
    where target_id = 'f0000000-0000-4000-8000-000000000003'), 'true', 'marked as logged late');
select is(
  (select count(*) from public.notifications where event = 'workout_finished'), 2::bigint,
  'and notifies nobody (the two live workouts did)');

-- a2 reads the feed and the cards' workouts
set local role authenticated;
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';
select results_eq(
  $$select jsonb_array_length(events) from public.feed_cards('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,
  $$values (2), (1)$$, 'newest day first, with its workouts');
select is(
  (select count(*) from public.workout_summaries(array[
     'f0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000002']::uuid[])),
  2::bigint, 'group mates see the workouts of a card');
select is(
  (select type_name from public.workout_summaries(array['f0000000-0000-4000-8000-000000000001']::uuid[])),
  'Laufen', 'with type and numbers');

-- reactions: one per person, the kind can change
select lives_ok(
  $$select public.set_reaction('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'feed_day',
      (select id from public.feed_days where day = private.local_day(
         '11111111-1111-4111-8111-111111111111', now())), null, 'fire')$$,
  'a2 reacts on the card');
select lives_ok(
  $$select public.set_reaction('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'feed_day',
      (select id from public.feed_days where day = private.local_day(
         '11111111-1111-4111-8111-111111111111', now())), null, 'strong')$$,
  'and changes it');
select results_eq($$select kind from public.reactions$$, $$values ('strong'::text)$$,
  'still one reaction, now 💪');
reset role;
select is(
  (select count(*) from public.notifications where event = 'reaction'), 1::bigint,
  'changing the kind does not notify twice');

-- other groups see nothing
set local role authenticated;
set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select is((select count(*) from public.feed_cards('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')), 0::bigint,
  'another group sees no cards');
select is(
  (select count(*) from public.workout_summaries(array['f0000000-0000-4000-8000-000000000001']::uuid[])),
  0::bigint, 'nor the workouts');
reset role;

-- a deleted workout leaves the feed, an empty card goes with it
delete from public.workouts where id = 'f0000000-0000-4000-8000-000000000003';
select is((select count(*) from public.feed_days), 1::bigint,
  'deleting the only workout of a day removes the card');

select * from finish();
rollback;
