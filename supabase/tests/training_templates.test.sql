-- Training templates: one owner edits; group mates use or copy; other groups see nothing.
--   a1, a2 share a group · b is in another group

begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

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
  ('e0000000-0000-4000-8000-000000000001', 'Test-Drücken', 'weight_reps'),
  ('e0000000-0000-4000-8000-000000000002', 'Test-Halten', 'duration');
insert into public.device_types (id, name) values
  ('70000000-0000-4000-8000-000000000001', 'Test-Presse');
insert into public.locations (id, name) values
  ('10000000-0000-4000-8000-000000000001', 'Test-Studio');
insert into public.devices (id, location_id, device_type_id) values
  ('d0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   '70000000-0000-4000-8000-000000000001');
insert into public.training_prefs (user_id, home_location_id) values
  ('22222222-2222-4222-8222-222222222222', '10000000-0000-4000-8000-000000000001');

create schema tests;
grant usage on schema tests to authenticated;
create function tests.studio() returns uuid language sql stable as $$
  select id from public.training_types where name = 'Studio' and owner_id is null
$$;
create function tests.push() returns uuid language sql stable as $$
  select id from public.training_focuses where name = 'Push' and owner_id is null
$$;
grant execute on function tests.studio(), tests.push() to authenticated;
create table tests.ids (key text primary key, id uuid);
grant all on tests.ids to authenticated;

-- a1 creates a template
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select lives_ok(
  $$insert into tests.ids values ('t1', public.save_template(null, 'Push A', tests.studio(),
      tests.push(), null,
      '[{"exerciseId": "e0000000-0000-4000-8000-000000000001",
         "deviceTypeId": "70000000-0000-4000-8000-000000000001",
         "sets": 3, "warmupSets": 1, "repMin": 8, "repMax": 12},
        {"exerciseId": "e0000000-0000-4000-8000-000000000002", "sets": 2,
         "durationSeconds": 45}]'::jsonb))$$,
  'people create templates with exercises');
select is((select count(*) from public.workout_template_items), 2::bigint, 'with their items');
select throws_ok(
  $$select public.save_template(null, 'Leer', tests.studio(), null, null, '[]'::jsonb)$$,
  'P0001', 'template_needs_exercises', 'a template needs at least one exercise');
reset role;

-- a2 (same group) sees it, cannot edit it, starts with it, copies it
set local role authenticated;
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';
select results_eq(
  $$select name, owner_name, exercise_count from public.template_overview()$$,
  $$values ('Push A'::text, 'A1'::text, 2)$$,
  'group mates see templates of others with their owner');
select throws_ok(
  $$select public.save_template((select id from tests.ids where key = 't1'), 'Hacked',
      tests.studio(), null, null,
      '[{"exerciseId": "e0000000-0000-4000-8000-000000000001", "sets": 1}]'::jsonb)$$,
  '42501', 'not_template_owner', 'only the owner edits a template');
update public.workout_templates set name = 'Hacked';
select is((select name from public.workout_templates), 'Push A', 'not even directly');
select lives_ok(
  $$select public.start_workout(tests.studio(), null, (select id from tests.ids where key = 't1'))$$,
  'group mates start with a template of others');
select results_eq(
  $$select i.position, i.device_id, count(s.*)::integer, count(s.*) filter (where s.is_warmup)::integer
      from public.workout_items i join public.workout_sets s on s.item_id = i.id
     group by i.id order by i.position$$,
  $$values (0, 'd0000000-0000-4000-8000-000000000001'::uuid, 4, 1), (1, null::uuid, 2, 0)$$,
  'exercises in order, the device of the type at the place, warm-up and working sets');
select is((select focus_id from public.workouts where status = 'active'), tests.push(),
  'the workout takes the template''s focus');
-- tick the sets and finish, then save it as an own template
update public.workout_sets set weight_kg = 50, reps = 9, completed_at = now()
 where item_id = (select id from public.workout_items where position = 0);
update public.workout_sets set duration_seconds = 40, completed_at = now()
 where item_id = (select id from public.workout_items where position = 1);
select public.finish_workout((select id from public.workouts where status = 'active'));
select lives_ok(
  $$insert into tests.ids values ('t2', public.template_from_workout(
      (select id from public.workouts limit 1), 'Mein Push'))$$,
  'a finished workout becomes a template');
select results_eq(
  $$select sets, warmup_sets, rep_min, rep_max from public.workout_template_items
     where template_id = (select id from tests.ids where key = 't2') order by position$$,
  $$values (3, 1, 9, 9), (2, 0, null::integer, null::integer)$$,
  'with the sets, warm-ups and reps done');
select lives_ok(
  $$insert into tests.ids values ('t3', public.copy_template((select id from tests.ids where key = 't1')))$$,
  'group mates copy a template');
select is(
  (select user_id from public.workout_templates where id = (select id from tests.ids where key = 't3')),
  '22222222-2222-4222-8222-222222222222'::uuid, 'the copy is their own');
reset role;

-- b (other group) sees nothing and cannot start with it
set local role authenticated;
set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select is((select count(*) from public.template_overview()), 0::bigint,
  'other groups see no templates');
select throws_ok(
  $$select public.start_workout(tests.studio(), null, (select id from tests.ids where key = 't1'))$$,
  '42501', 'template_not_visible', 'and cannot start with them');
reset role;

-- a1 deletes the template; workouts keep everything but the link
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
delete from public.workout_templates where id = (select id from tests.ids where key = 't1');
reset role;
select is((select count(*) from public.workouts where template_id is null), 1::bigint,
  'deleting a template keeps the workouts started with it');

select * from finish();
rollback;
