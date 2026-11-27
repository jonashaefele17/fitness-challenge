-- Weight in the feed (7b): Monday's look back, only for people who share their weight and
-- weighed last week, not before 7:00, once, no figures stored, no notification; single
-- weigh-ins post nothing; the other group sees nothing.
--   a1 shares in % and weighs · a2 weighs but keeps it private · a3 shares in kg but did not
--   weigh last week · b shares in kg in group B

begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

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

create schema tests;
grant usage on schema tests to authenticated;
create function tests.events() returns bigint language sql as $$
  select count(*) from public.feed_events where type = 'weight_week'
$$;
grant execute on all functions in schema tests to authenticated;

set local role authenticated;
-- a1: shares in %, weighs on Tue 8.12. and Sat 12.12. (week Mon 7.12. – Sun 13.12.)
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
insert into public.body_settings (weight_share) values ('percent');
insert into public.weigh_ins (measured_on, weight_kg) values ('2026-12-01', 81.0), ('2026-12-08', 80.5), ('2026-12-12', 80.1);
-- a2: weighs, private
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';
insert into public.weigh_ins (measured_on, weight_kg) values ('2026-12-09', 70.0);
-- a3: shares in kg, last weighed the week before
set local request.jwt.claims to '{"sub": "44444444-4444-4444-8444-444444444444", "role": "authenticated"}';
insert into public.body_settings (weight_share) values ('kg');
insert into public.weigh_ins (measured_on, weight_kg) values ('2026-12-06', 90.0);
-- b: shares in kg, weighs on Sunday 13.12.
set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
insert into public.body_settings (weight_share) values ('kg');
insert into public.weigh_ins (measured_on, weight_kg) values ('2026-12-13', 60.0);
reset role;

select is(tests.events(), 0::bigint, 'single weigh-ins post nothing');
select is(private.post_weight_feed('2026-12-14 06:30+01'), 0, 'nothing before 7:00');
select is(private.post_weight_feed('2026-12-14 07:30+01'), 2, 'Monday 7:30: a1 in group A, b in group B');
select results_eq(
  $$select actor_id, group_id, data from public.feed_events where type = 'weight_week' order by group_id$$,
  $$values ('11111111-1111-4111-8111-111111111111'::uuid, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
            '{"weekStart": "2026-12-07"}'::jsonb),
           ('33333333-3333-4333-8333-333333333333', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            '{"weekStart": "2026-12-07"}')$$,
  'about last week, no figures; not for the private a2, not for a3 without entries');
select is(
  (select fd.day from public.feed_events fe join public.feed_days fd on fd.id = fe.feed_day_id
    where fe.type = 'weight_week' and fe.actor_id = '11111111-1111-4111-8111-111111111111'),
  '2026-12-14'::date, 'on the person''s Monday card');
select is(private.post_weight_feed('2026-12-14 08:30+01'), 0, 'once');
select is(private.post_weight_feed('2026-12-15 07:30+01'), 0, 'Tuesday: no look back');
select is(private.post_weight_feed('2026-12-21 07:30+01'), 0, 'next Monday: nobody weighed that week');
select is((select count(*) from public.notifications), 0::bigint, 'no notification');

set local role authenticated;
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';
select is(tests.events(), 1::bigint, 'the group sees a1''s look back');
select is(
  (select change_pct from public.weight_summary('11111111-1111-4111-8111-111111111111', '2026-12-07', '2026-12-13')),
  -0.25::numeric, 'and the card gets the figures live from the body module');
set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select is(tests.events(), 1::bigint, 'another group sees only its own');

-- a1 stops sharing: the card shows nothing any more
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
update public.body_settings set weight_share = 'private';
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';
select results_eq(
  $$select change_pct, share from public.weight_summary('11111111-1111-4111-8111-111111111111', '2026-12-07', '2026-12-13')$$,
  $$values (null::numeric, null::text)$$,
  'after switching to private the card gets nothing');
reset role;
insert into public.weigh_ins (user_id, measured_on, weight_kg)
  values ('11111111-1111-4111-8111-111111111111', '2026-12-22', 79.9);
select is(private.post_weight_feed('2026-12-28 07:30+01'), 0, 'and nothing more is posted though a1 weighed');

select * from finish();
rollback;
