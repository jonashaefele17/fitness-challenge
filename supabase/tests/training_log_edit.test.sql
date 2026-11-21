-- Adding a workout afterwards and moving it: a logged workout is finished and quiet in the
-- feed; moving it carries its feed card along; only the owner can.
--   a1, a2 share group A

begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'a1@test.local'),
  ('22222222-2222-4222-8222-222222222222', 'a2@test.local');
insert into public.profiles (id, display_name, color) values
  ('11111111-1111-4111-8111-111111111111', 'A1', 'person-1'),
  ('22222222-2222-4222-8222-222222222222', 'A2', 'person-2');
insert into public.groups (id, name) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'A');
insert into public.group_members (group_id, user_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222');
insert into public.notification_prefs (user_id, preset) values
  ('22222222-2222-4222-8222-222222222222', 'all');
insert into public.exercises (id, name, measure) values
  ('e0000000-0000-4000-8000-000000000001', 'Test-Drücken', 'weight_reps');

create schema tests;
grant usage on schema tests to authenticated;
create table tests.ids (key text primary key, id uuid);
grant all on tests.ids to authenticated;

set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
insert into tests.ids values ('t', public.save_template(null, 'Push',
  (select id from public.training_types where name = 'Studio' and owner_id is null), null, null,
  '[{"exerciseId": "e0000000-0000-4000-8000-000000000001", "sets": 3, "warmupSets": 1}]'::jsonb));

-- two hours ago, from the template: still "late" because it was added afterwards
select lives_ok(
  $$insert into tests.ids values ('w', public.log_past_workout(
      (select id from public.training_types where name = 'Studio' and owner_id is null),
      now() - interval '2 hours', 3600, (select id from tests.ids where key = 't')))$$,
  'a workout is added afterwards');
select is((select status::text from public.workouts where id = (select id from tests.ids where key = 'w')),
  'finished', 'it is finished right away');
select is(
  (select count(*) from public.workout_sets s join public.workout_items i on i.id = s.item_id
    where i.workout_id = (select id from tests.ids where key = 'w')),
  4::bigint, 'with the template''s exercises and sets to fill in');
select throws_ok(
  $$select public.log_past_workout(
      (select id from public.training_types where name = 'Laufen' and owner_id is null),
      now() + interval '1 day', 1800)$$,
  'P0001', 'invalid_time', 'not in the future');
reset role;

select is(
  (select data ->> 'late' from public.feed_events
    where target_id = (select id from tests.ids where key = 'w')), 'true',
  'in the feed it counts as added later');
select is(
  (select count(*) from public.notifications where event = 'workout_finished'), 0::bigint,
  'and notifies nobody');

-- moved to three days earlier: the card moves along
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select lives_ok(
  $$select public.update_workout_time((select id from tests.ids where key = 'w'),
      now() - interval '3 days', 5400)$$,
  'the owner moves it and changes the duration');
reset role;
select is(
  (select fd.day from public.feed_events fe join public.feed_days fd on fd.id = fe.feed_day_id
    where fe.target_id = (select id from tests.ids where key = 'w')),
  private.local_day('11111111-1111-4111-8111-111111111111', now() - interval '3 days'),
  'its feed card is now on that day');
select is(
  (select count(*) from public.feed_days where kind = 'day'), 1::bigint,
  'the old, now empty card is gone');

set local role authenticated;
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';
select throws_ok(
  $$select public.update_workout_time((select id from tests.ids where key = 'w'),
      now() - interval '1 day', 3600)$$,
  '42501', 'not_workout_owner', 'others cannot change it');
reset role;

select * from finish();
rollback;
