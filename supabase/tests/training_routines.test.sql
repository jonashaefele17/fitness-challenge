-- Guided routines: Mobility is a guided default type; a routine's rest, both-sides and
-- target time reach the workout; a both-sides round is two sets.

begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (id, email) values ('11111111-1111-4111-8111-111111111111', 'a@test.local');
insert into public.profiles (id, display_name, color)
values ('11111111-1111-4111-8111-111111111111', 'A', 'person-1');
insert into public.exercises (id, name, measure) values
  ('e0000000-0000-4000-8000-000000000001', 'Test-Dehnung', 'duration'),
  ('e0000000-0000-4000-8000-000000000002', 'Test-Kreisen', 'duration');

select is(
  (select guided from public.training_types where name = 'Mobility' and owner_id is null),
  true, 'Mobility is a guided default training type');

set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select lives_ok(
  $$select public.start_workout(
      (select id from public.training_types where name = 'Mobility' and owner_id is null), null,
      public.save_template(null, 'Morgens',
        (select id from public.training_types where name = 'Mobility' and owner_id is null),
        null, null,
        '[{"exerciseId": "e0000000-0000-4000-8000-000000000001", "sets": 2,
           "durationSeconds": 45, "restSeconds": 15, "perSide": true},
          {"exerciseId": "e0000000-0000-4000-8000-000000000002", "sets": 1,
           "durationSeconds": 30}]'::jsonb))$$,
  'a routine starts like any template');
select results_eq(
  $$select target_seconds, rest_seconds, per_side from public.workout_items order by position$$,
  $$values (45, 15, true), (30, 0, false)$$,
  'target time, rest and both-sides reach the workout');
select results_eq(
  $$select count(s.*)::integer from public.workout_items i
      join public.workout_sets s on s.item_id = i.id group by i.position order by i.position$$,
  $$values (4), (1)$$,
  'a both-sides round is two sets (left, right)');
select is(
  (select catalog from public.exercises where id = 'e0000000-0000-4000-8000-000000000001'),
  'strength', 'new exercises start in the strength catalogue');
reset role;

-- Mobility: own catalogue and only the body-region focuses
update public.exercises set catalog = 'mobility' where id = 'e0000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select is(
  (select count(*) from public.search_exercises('Test-Dehnung')), 0::bigint,
  'mobility exercises do not show up in the strength search');
select is(
  (select count(*) from public.search_exercises('Test-Dehnung', 20, 'mobility')), 1::bigint,
  'but in the mobility catalogue');
reset role;
select results_eq(
  $$select f.name from public.training_types t, unnest(t.focus_ids) with ordinality as x(id, n)
      join public.training_focuses f on f.id = x.id
     where t.name = 'Mobility' and t.owner_id is null order by x.n$$,
  $$values ('Oberkörper'::text), ('Unterkörper'::text), ('Ganzkörper'::text)$$,
  'Mobility only offers the body-region focuses');

select * from finish();
rollback;
