-- Training catalogue: global exercises/studios, private places, personal types and settings.
--
--   a1, a2  share group A        b  is in another group (sees none of A's private data)
--   s       super admin

begin;
create extension if not exists pgtap with schema extensions;

select plan(41);

-- Start from an empty catalogue (seed migrations add a starter catalogue).
delete from public.devices;
delete from public.device_type_exercises;
delete from public.device_types;
delete from public.training_focuses where owner_id is not null;
delete from public.locations;
delete from public.exercise_aliases;
delete from public.exercise_muscles;
delete from public.exercises;

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'a1@test.local'),
  ('22222222-2222-4222-8222-222222222222', 'a2@test.local'),
  ('33333333-3333-4333-8333-333333333333', 'b@test.local'),
  ('55555555-5555-4555-8555-555555555555', 's@test.local');
insert into public.profiles (id, display_name, color, is_super_admin) values
  ('11111111-1111-4111-8111-111111111111', 'A1', 'person-1', false),
  ('22222222-2222-4222-8222-222222222222', 'A2', 'person-2', false),
  ('33333333-3333-4333-8333-333333333333', 'B', 'person-3', false),
  ('55555555-5555-4555-8555-555555555555', 'S', 'person-4', true);
insert into public.groups (id, name) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'A'), ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'B');
insert into public.group_members (group_id, user_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '33333333-3333-4333-8333-333333333333');

-- ---------------------------------------------------------------------------
-- a1 builds catalogue entries
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

select lives_ok(
  $$insert into public.exercises (id, name, measure, created_by) values
    ('e0000000-0000-4000-8000-000000000001', 'Bankdrücken', 'weight_reps',
     '11111111-1111-4111-8111-111111111111')$$,
  'anyone signed in can add an exercise');
select throws_ok(
  $$insert into public.exercises (name, measure, created_by) values
    ('  bankdrücken ', 'weight_reps', '11111111-1111-4111-8111-111111111111')$$,
  '23505', null, 'exercise names are unique (case and spaces ignored)');
select throws_ok(
  $$insert into public.exercises (name, measure, created_by) values
    ('Kniebeuge', 'weight_reps', '22222222-2222-4222-8222-222222222222')$$,
  '42501', null, 'exercises cannot be created in someone else''s name');
select lives_ok(
  $$insert into public.exercise_aliases (exercise_id, alias) values
    ('e0000000-0000-4000-8000-000000000001', 'Bench Press')$$,
  'the creator adds aliases');
select lives_ok(
  $$insert into public.exercise_muscles (exercise_id, muscle_group, role) values
    ('e0000000-0000-4000-8000-000000000001', 'chest', 'primary'),
    ('e0000000-0000-4000-8000-000000000001', 'triceps', 'secondary')$$,
  'the creator sets muscle groups');
select results_eq(
  $$select name from public.search_exercises('bench')$$,
  $$values ('Bankdrücken'::text)$$,
  'search finds exercises by alias');

select lives_ok(
  $$insert into public.locations (id, name, created_by) values
    ('10000000-0000-4000-8000-000000000001', 'FitX Karlsruhe', '11111111-1111-4111-8111-111111111111')$$,
  'anyone can add a public studio');
select lives_ok(
  $$insert into public.locations (id, name, owner_id, created_by) values
    ('10000000-0000-4000-8000-000000000002', 'Home Gym', '11111111-1111-4111-8111-111111111111',
     '11111111-1111-4111-8111-111111111111')$$,
  'a person creates a private place');
select throws_ok(
  $$insert into public.locations (name, owner_id, created_by) values
    ('Fremdes Gym', '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111')$$,
  '42501', null, 'nobody creates private places for others');
select lives_ok(
  $$insert into public.device_types (id, name, default_weight_step, comparable) values
    ('70000000-0000-4000-8000-000000000001', 'Kurzhanteln', 2.5, true),
    ('70000000-0000-4000-8000-000000000002', 'Kabelzug', 5, false)$$,
  'anyone adds device types');
select throws_ok(
  $$insert into public.device_types (name) values (' kabelzug')$$,
  '23505', null, 'device type names are unique (case and spaces ignored)');
select lives_ok(
  $$insert into public.devices (id, location_id, device_type_id, created_by) values
    ('d0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
     '70000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111'),
    ('d0000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001',
     '70000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111')$$,
  'devices at the own private place and at public studios');
select throws_ok(
  $$insert into public.devices (location_id, device_type_id, created_by) values
    ('10000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000002',
     '11111111-1111-4111-8111-111111111111')$$,
  '23505', null, 'one device per type and place');
select lives_ok(
  $$insert into public.device_type_exercises (device_type_id, exercise_id) values
    ('70000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001'),
    ('70000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001')$$,
  'members link exercises to device types');
select lives_ok(
  $$insert into public.device_hidden_exercises (device_id, exercise_id) values
    ('d0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001')$$,
  'members hide an exercise a public studio device does not offer');
select lives_ok(
  $$insert into public.training_focuses (id, name, muscle_groups, owner_id) values
    ('f0000000-0000-4000-8000-000000000001', 'Brust & Bizeps', array['chest', 'biceps'],
     '11111111-1111-4111-8111-111111111111')$$,
  'people define their own training focus');
select lives_ok(
  $$insert into public.user_device_settings (device_id, exercise_id, "values") values
    ('d0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001', '{"Höhe": "12"}')$$,
  'personal device settings');
select lives_ok(
  $$insert into public.training_types (name, kind, owner_id) values
    ('Klettern', 'duration', '11111111-1111-4111-8111-111111111111')$$,
  'personal training types');
select throws_ok(
  $$insert into public.training_types (name, kind, with_distance, owner_id) values
    ('Komisch', 'exercises', true, '11111111-1111-4111-8111-111111111111')$$,
  '23514', null, 'distance only for duration types');
select lives_ok(
  $$insert into public.training_prefs (home_location_id) values ('10000000-0000-4000-8000-000000000001')$$,
  'home studio is stored in the training preferences');
reset role;

-- ---------------------------------------------------------------------------
-- a2 (same group) sees a1's private place; cannot edit a1's entries
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';
select is((select count(*) from public.locations), 2::bigint,
  'group mates see public studios and each other''s private places');
select is((select count(*) from public.devices), 2::bigint, 'and their devices');
select is((select count(*) from public.device_hidden_exercises), 1::bigint,
  'hidden exercises at visible devices are visible');
select is((select count(*) from public.training_focuses where owner_id is null), 7::bigint,
  'seven default training focuses');
select is((select count(*) from public.training_focuses), 8::bigint,
  'group mates see each other''s training focuses');
update public.training_focuses set name = 'Hacked' where id = 'f0000000-0000-4000-8000-000000000001';
select is((select name from public.training_focuses where id = 'f0000000-0000-4000-8000-000000000001'),
  'Brust & Bizeps', 'others cannot edit someone''s training focus');
delete from public.device_type_exercises
 where device_type_id = '70000000-0000-4000-8000-000000000001';
select is((select count(*) from public.device_type_exercises), 2::bigint,
  'members hide instead of removing exercises from a type');
select is((select count(*) from public.training_types), 6::bigint,
  'group mates see default and personal training types');
select is((select count(*) from public.user_device_settings), 0::bigint,
  'device settings stay private');
update public.exercises set name = 'Hacked' where id = 'e0000000-0000-4000-8000-000000000001';
select is((select name from public.exercises where id = 'e0000000-0000-4000-8000-000000000001'),
  'Bankdrücken', 'others cannot rename an exercise');
select throws_ok(
  $$insert into public.devices (location_id, device_type_id, created_by) values
    ('10000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000002',
     '22222222-2222-4222-8222-222222222222')$$,
  '42501', null, 'nobody adds devices to someone else''s private place');
update public.devices set weight_step = 1.25 where id = 'd0000000-0000-4000-8000-000000000002';
update public.devices set weight_step = 99 where id = 'd0000000-0000-4000-8000-000000000001';
select is(
  (select weight_step from public.devices where id = 'd0000000-0000-4000-8000-000000000002'),
  1.25::numeric, 'members may edit devices at public studios');
select is(
  (select weight_step from public.devices where id = 'd0000000-0000-4000-8000-000000000001'),
  null::numeric, 'devices at someone else''s private place stay untouched');
select throws_ok(
  $$insert into public.device_hidden_exercises (device_id, exercise_id) values
    ('d0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001')$$,
  '42501', null, 'nobody hides exercises at someone else''s private place');
select throws_ok(
  $$insert into public.exercise_aliases (exercise_id, alias) values
    ('e0000000-0000-4000-8000-000000000001', 'Brustpresse')$$,
  '42501', null, 'only editors add aliases');
reset role;

-- ---------------------------------------------------------------------------
-- b (other group) sees the global catalogue but nothing private of group A
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select is((select count(*) from public.exercises), 1::bigint, 'the exercise catalogue is global');
select is((select count(*) from public.locations), 1::bigint,
  'only public studios are visible to other groups');
select is((select count(*) from public.devices), 1::bigint,
  'devices at private places of other groups are hidden');
select is((select count(*) from public.training_focuses), 7::bigint,
  'training focuses of other groups are hidden');
select is((select count(*) from public.training_types), 5::bigint,
  'personal training types of other groups are hidden');
reset role;

-- ---------------------------------------------------------------------------
-- super admin may correct catalogue entries
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "55555555-5555-4555-8555-555555555555", "role": "authenticated"}';
update public.exercises set name = 'Bankdrücken (Langhantel)'
 where id = 'e0000000-0000-4000-8000-000000000001';
reset role;
select is((select name from public.exercises where id = 'e0000000-0000-4000-8000-000000000001'),
  'Bankdrücken (Langhantel)', 'the super admin can correct catalogue entries');

select * from finish();
rollback;
