-- Adding a workout afterwards and moving it: a logged workout is finished and quiet in the
-- feed; moving it carries its feed card along; only the owner can.
--   a1, a2 share group A

begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

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

-- "Änderungen verwerfen": back to the state when editing began; comments stay attached
create function tests.snapshot(p_id uuid) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'startedAt', w.started_at, 'endedAt', w.ended_at, 'durationSeconds', w.duration_seconds,
    'pausedSeconds', w.paused_seconds, 'locationId', w.location_id, 'focusId', w.focus_id,
    'items', coalesce((select jsonb_agg(jsonb_build_object(
        'id', i.id, 'exerciseId', i.exercise_id, 'deviceId', i.device_id, 'position', i.position,
        'note', i.note, 'repMin', i.rep_min, 'repMax', i.rep_max,
        'targetSeconds', i.target_seconds, 'restSeconds', i.rest_seconds,
        'perSide', i.per_side, 'sideRestSeconds', i.side_rest_seconds,
        'sets', coalesce((select jsonb_agg(jsonb_build_object(
            'id', s.id, 'position', s.position, 'weightKg', s.weight_kg, 'reps', s.reps,
            'durationSeconds', s.duration_seconds, 'isWarmup', s.is_warmup,
            'completedAt', s.completed_at)) from public.workout_sets s where s.item_id = i.id),
          '[]'::jsonb)))
      from public.workout_items i where i.workout_id = w.id), '[]'::jsonb))
  from public.workouts w where w.id = p_id
$$;
grant execute on function tests.snapshot(uuid) to authenticated;
create table tests.snap (snap jsonb);
grant all on tests.snap to authenticated;

set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
insert into tests.snap select tests.snapshot((select id from tests.ids where key = 'w'));
select public.post_comment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'workout_item',
  (select id from public.workout_items where workout_id = (select id from tests.ids where key = 'w')),
  'Gut!', 1);
-- edit: a set, a new exercise, the time
update public.workout_sets set weight_kg = 99, completed_at = now()
 where item_id = (select id from public.workout_items where workout_id = (select id from tests.ids where key = 'w'))
   and position = 1;
insert into public.workout_items (workout_id, exercise_id, position)
values ((select id from tests.ids where key = 'w'), 'e0000000-0000-4000-8000-000000000001', 1);
select public.update_workout_time((select id from tests.ids where key = 'w'), now() - interval '1 day', 1800);
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';
select throws_ok(
  $$select public.restore_workout((select id from tests.ids where key = 'w'), (select snap from tests.snap))$$,
  '42501', 'not_workout_owner', 'others cannot discard the changes');
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select lives_ok(
  $$select public.restore_workout((select id from tests.ids where key = 'w'), (select snap from tests.snap))$$,
  'the owner discards the changes');
reset role;

select is(
  (select count(*) from public.workout_items where workout_id = (select id from tests.ids where key = 'w')),
  1::bigint, 'the exercise added while editing is gone');
select is(
  (select weight_kg from public.workout_sets s join public.workout_items i on i.id = s.item_id
    where i.workout_id = (select id from tests.ids where key = 'w') and s.position = 1),
  null::numeric, 'the set is as before');
select is(
  (select fd.day from public.feed_events fe join public.feed_days fd on fd.id = fe.feed_day_id
    where fe.target_id = (select id from tests.ids where key = 'w')),
  private.local_day('11111111-1111-4111-8111-111111111111', now() - interval '3 days'),
  'the workout and its card are back on their day');
select is((select count(*) from public.comments where body = 'Gut!'), 1::bigint,
  'the comment on the set is still there');

select * from finish();
rollback;
