-- Body weight (7a): scales (first is main, one main, offsets re-based when the main scale
-- changes), weigh-ins (own scales only), day values with offsets, 7-day trend (also from
-- before the range), summary, offset suggestion, and that all of it is private.
--   a1 weighs · a2 is in the same group · b is in another group

begin;
create extension if not exists pgtap with schema extensions;

select plan(48);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'a1@test.local'),
  ('22222222-2222-4222-8222-222222222222', 'a2@test.local'),
  ('33333333-3333-4333-8333-333333333333', 'b@test.local');
insert into public.profiles (id, display_name, color) values
  ('11111111-1111-4111-8111-111111111111', 'A1', 'person-1'),
  ('22222222-2222-4222-8222-222222222222', 'A2', 'person-2'),
  ('33333333-3333-4333-8333-333333333333', 'B', 'person-3');
insert into public.groups (id, name) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'B');
insert into public.group_members (group_id, user_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '33333333-3333-4333-8333-333333333333');

create schema tests;
grant usage on schema tests to authenticated;
-- a scale by name (any owner; security definer so tests can name others' scales)
create function tests.scale(p_name text) returns uuid language sql stable security definer as $$
  select id from public.scales where name = p_name
$$;
grant execute on all functions in schema tests to authenticated;

-- b has a scale of their own
set local role authenticated;
set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
insert into public.scales (name) values ('B-Waage');

-- Summary without any data: one row of nulls
select results_eq(
  $$select current_trend_kg, start_trend_kg, change_kg, change_pct, latest_kg, days_with_entries
      from public.weight_summary('33333333-3333-4333-8333-333333333333', '2026-12-01', '2026-12-31')$$,
  $$values (null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0)$$,
  'summary without data: nulls and 0 days');

-- a1: two scales and a spare one
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
insert into public.scales (name) values ('Zuhause');
insert into public.scales (name, offset_kg) values ('Studio', 0.6);
insert into public.scales (name) values ('Hotel');

select results_eq(
  $$select name, is_main, offset_kg from public.scales order by array_position(array['Zuhause','Studio','Hotel'], name)$$,
  $$values ('Zuhause'::text, true, 0.00::numeric), ('Studio', false, 0.60), ('Hotel', false, 0.00)$$,
  'the first scale becomes the main scale by itself');
select throws_ok(
  $$insert into public.scales (name, is_main) values ('Neu', true)$$,
  '42501', null, 'the main scale is not set by hand on insert');
select throws_ok(
  $$update public.scales set is_main = true where name = 'Hotel'$$,
  '42501', null, 'nor by update');
select throws_ok(
  $$update public.scales set offset_kg = 25 where name = 'Hotel'$$,
  '23514', null, 'offsets stay within ±20 kg');
select throws_ok(
  $$update public.scales set offset_kg = 1 where name = 'Zuhause'$$,
  '23514', null, 'the main scale has no offset');

-- Weigh-ins
--   25.11. Zuhause 82.0 · 27.11. no scale 81.0 · 01.12. Zuhause 80.0 + Studio 81.0 (−0.6)
--   03.12. Zuhause 79.8 · 04.12. Zuhause 79.5 + Studio 80.0
insert into public.weigh_ins (scale_id, measured_on, weight_kg) values
  (tests.scale('Zuhause'), '2026-11-25', 82.0),
  (null, '2026-11-27', 81.0),
  (tests.scale('Zuhause'), '2026-12-01', 80.0),
  (tests.scale('Studio'), '2026-12-01', 81.0),
  (tests.scale('Zuhause'), '2026-12-03', 79.8),
  (tests.scale('Zuhause'), '2026-12-04', 79.5),
  (tests.scale('Studio'), '2026-12-04', 80.0);
-- On the 4th: home in the morning, gym in the evening
update public.weigh_ins set measured_at = '2026-12-04 07:00+01' where measured_on = '2026-12-04' and weight_kg = 79.5;
update public.weigh_ins set measured_at = '2026-12-04 19:00+01' where measured_on = '2026-12-04' and weight_kg = 80.0;

select throws_ok(
  $$insert into public.weigh_ins (scale_id, measured_on, weight_kg)
    values (tests.scale('B-Waage'), '2026-12-01', 80)$$,
  '23503', null, 'someone else''s scale cannot be attached to my weigh-in');
select throws_ok(
  $$update public.weigh_ins set scale_id = tests.scale('B-Waage') where measured_on = '2026-12-03'$$,
  '23503', null, 'not by update either');
select throws_ok(
  $$insert into public.weigh_ins (measured_on, weight_kg) values ('2026-12-01', 12)$$,
  '23514', null, 'weights stay plausible (20–400 kg)');
select throws_ok(
  $$insert into public.weigh_ins (measured_on, weight_kg, source) values ('2026-12-01', 80, 'training')$$,
  '23514', null, 'source is manual or external');
select throws_ok(
  $$insert into public.weigh_ins (user_id, measured_on, weight_kg)
    values ('22222222-2222-4222-8222-222222222222', '2026-12-01', 80)$$,
  '42501', null, 'nobody enters weights for someone else');

-- Day values and trend
select results_eq(
  $$select on_date, weight_kg, entries, trend_kg
      from public.weight_days('11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-03')$$,
  $$values ('2026-12-01'::date, 80.20::numeric, 2, 81.07::numeric),
           ('2026-12-03'::date, 79.80::numeric, 1, 80.33::numeric)$$,
  'day average with the offset taken off; 7-day trend uses days before the range');
select is(
  (select count(*)::integer from public.weight_days('11111111-1111-4111-8111-111111111111', null, '2026-12-31')),
  5, 'without a start: all days');

-- Summary
select results_eq(
  $$select current_trend_kg, current_on, start_trend_kg, start_on, change_kg, change_pct,
           latest_kg, latest_adjusted_kg, latest_on, days_with_entries
      from public.weight_summary('11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-03')$$,
  $$values (80.33::numeric, '2026-12-03'::date, 81.07::numeric, '2026-12-01'::date,
            -0.74::numeric, -0.91::numeric, 79.80::numeric, 79.80::numeric, '2026-12-03'::date, 2)$$,
  'summary: trend now and at the start, change in kg and %');
select is(
  (select latest_scale_id from public.weight_summary('11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-04')),
  tests.scale('Studio'), 'the latest entry comes with its scale');
select is(
  (select latest_adjusted_kg from public.weight_summary('11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-04')),
  79.40::numeric, 'and with its offset taken off');

-- Offset suggestion
select results_eq(
  $$select suggested_offset_kg, common_days from public.scale_offset_suggestion(tests.scale('Studio'))$$,
  $$values (0.75::numeric, 2)$$,
  'suggestion: average difference over the days on both scales');
select results_eq(
  $$select suggested_offset_kg, common_days from public.scale_offset_suggestion(tests.scale('Hotel'))$$,
  $$values (null::numeric, 0)$$,
  'no common days: no suggestion');
select is_empty(
  $$select * from public.scale_offset_suggestion(tests.scale('Zuhause'))$$,
  'no suggestion for the main scale');

-- Archive: not the main scale while others are in use
select throws_ok(
  $$update public.scales set archived_at = now() where name = 'Zuhause'$$,
  'P0001', 'main_scale_in_use', 'the main scale is not archived while others are in use');
select lives_ok(
  $$update public.scales set archived_at = now() where name = 'Hotel'$$,
  'another scale is archived');

-- One main scale at most
-- (triggers off, so only the index stands in the way)
reset role;
set local session_replication_role = replica;
select throws_ok(
  $$update public.scales set is_main = true, archived_at = null where name = 'Hotel'$$,
  '23505', null, 'at most one main scale in use');
set local session_replication_role = origin;
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

-- A new main scale: offsets re-based, entries without a scale stay with the old main
select lives_ok($$select public.set_main_scale(tests.scale('Studio'))$$, 'Studio becomes the main scale');
select results_eq(
  $$select name, is_main, offset_kg from public.scales order by array_position(array['Zuhause','Studio','Hotel'], name)$$,
  $$values ('Zuhause'::text, false, -0.60::numeric), ('Studio', true, 0.00), ('Hotel', false, -0.60)$$,
  'offsets are now relative to Studio (archived scales too)');
select is(
  (select scale_id from public.weigh_ins where measured_on = '2026-11-27'),
  tests.scale('Zuhause'), 'the entry without a scale stays with the old main scale');
select results_eq(
  $$select on_date, weight_kg, trend_kg
      from public.weight_days('11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-03')$$,
  $$values ('2026-12-01'::date, 80.80::numeric, 81.67::numeric),
           ('2026-12-03'::date, 80.40::numeric, 80.93::numeric)$$,
  'day values move by Studio''s old offset, in Studio''s terms');
select is(
  (select change_kg from public.weight_summary('11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-03')),
  -0.74::numeric, 'the change stays the same');
select is(
  (select common_days from public.scale_offset_suggestion(tests.scale('Zuhause'))),
  2, 'the suggestion now works for the old main scale');
select is(
  (select suggested_offset_kg from public.scale_offset_suggestion(tests.scale('Zuhause'))),
  -0.75::numeric, 'with the sign turned');

-- And back: everything as before
select public.set_main_scale(tests.scale('Zuhause'));
select results_eq(
  $$select on_date, weight_kg, entries, trend_kg
      from public.weight_days('11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-03')$$,
  $$values ('2026-12-01'::date, 80.20::numeric, 2, 81.07::numeric),
           ('2026-12-03'::date, 79.80::numeric, 1, 80.33::numeric)$$,
  'back to Zuhause: the day values are the same as before');
select results_eq(
  $$select name, offset_kg from public.scales order by array_position(array['Zuhause','Studio','Hotel'], name)$$,
  $$values ('Zuhause'::text, 0.00::numeric), ('Studio', 0.60), ('Hotel', 0.00)$$,
  'and so are the offsets');
select throws_ok(
  $$select public.set_main_scale(tests.scale('Hotel'))$$,
  '42501', 'scale_not_found', 'an archived scale does not become the main scale');

insert into public.body_settings (weigh_reminder_days, weigh_reminder_at) values ('{1}', '07:00');

-- a2, same group: sees nothing
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';
select is((select count(*) from public.scales), 0::bigint, 'same group: no scales of others');
select is((select count(*) from public.weigh_ins), 0::bigint, 'same group: no weigh-ins of others');
select is((select count(*) from public.body_settings), 0::bigint, 'same group: no settings of others');
select is_empty(
  $$select * from public.weight_days('11111111-1111-4111-8111-111111111111', null, '2026-12-31')$$,
  'same group: no day values');
select is(
  (select days_with_entries from public.weight_summary('11111111-1111-4111-8111-111111111111', null, '2026-12-31')),
  0, 'same group: an empty summary');
select is_empty(
  $$select * from public.scale_offset_suggestion(tests.scale('Studio'))$$,
  'same group: no suggestion');
select throws_ok(
  $$select public.set_main_scale(tests.scale('Studio'))$$,
  '42501', 'scale_not_found', 'same group: cannot change the main scale of others');
update public.weigh_ins set weight_kg = 50;
delete from public.weigh_ins;
update public.scales set name = 'X';

-- b, other group: sees nothing either
set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select is((select count(*) from public.scales), 1::bigint, 'other group: only the own scale');
select is((select count(*) from public.weigh_ins), 0::bigint, 'other group: no weigh-ins of others');
select is((select count(*) from public.body_settings), 0::bigint, 'other group: no settings of others');
select is_empty(
  $$select * from public.weight_days('11111111-1111-4111-8111-111111111111', null, '2026-12-31')$$,
  'other group: no day values');

-- b: the last scale in use may be archived; one brought back while none is main becomes it
insert into public.scales (name, offset_kg) values ('B-Studio', 1.0);
update public.scales set archived_at = now() where name = 'B-Studio';
select lives_ok(
  $$update public.scales set archived_at = now() where name = 'B-Waage'$$,
  'the main scale may be archived when it is the only one in use');
update public.scales set archived_at = null where name = 'B-Studio';
select results_eq(
  $$select name, is_main, offset_kg from public.scales order by name$$,
  $$values ('B-Studio'::text, true, 0.00::numeric), ('B-Waage', false, -1.00)$$,
  'a scale brought back without a main scale becomes it, offsets re-based');
select results_eq(
  $$select name, is_main from public.scales where archived_at is null$$,
  $$values ('B-Studio'::text, true)$$,
  'and is the only one in use');

reset role;
select is((select count(*) from public.weigh_ins where weight_kg = 50), 0::bigint,
  'others'' updates and deletes did not reach a1''s weigh-ins');
select is((select count(*) from public.weigh_ins), 7::bigint, 'all of a1''s weigh-ins are still there');

select * from finish();
rollback;
