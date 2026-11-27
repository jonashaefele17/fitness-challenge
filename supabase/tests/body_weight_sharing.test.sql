-- Body weight shared with the group (7b): private (default) shows nothing, percent only the
-- change in %, kg also the trend in kg; never single entries, scales or entry counts; the
-- other group sees nothing at any level; the owner's figures do not depend on the level.
--   a1 weighs · a2 is in the same group · b is in another group

begin;
create extension if not exists pgtap with schema extensions;

select plan(55);

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
create function tests.scale(p_name text) returns uuid language sql stable security definer as $$
  select id from public.scales where name = p_name
$$;
-- Every kg column (and every column beyond the trend) others could get from the functions.
create function tests.kg_columns(p_user uuid) returns bigint language sql stable as $$
  select (select count(*) from public.weight_progress(p_user, '2026-12-01', '2026-12-04')
           where trend_kg is not null)
       + (select count(*) from public.weight_summary(p_user, '2026-12-01', '2026-12-04')
           where current_trend_kg is not null or start_trend_kg is not null
              or change_kg is not null or latest_kg is not null
              or latest_adjusted_kg is not null or latest_scale_id is not null
              or latest_on is not null or days_with_entries <> 0)
$$;
grant execute on all functions in schema tests to authenticated;

-- a1: Zuhause (main) and Studio (+0.6)
--   day values 25.11. 82.0 · 27.11. 81.0 · 01.12. 80.2 · 03.12. 79.8 · 04.12. 79.45
--   trends     25.11. 82.0 · 27.11. 81.5 · 01.12. 81.07 · 03.12. 80.33 · 04.12. 79.82
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
insert into public.scales (name) values ('Zuhause');
insert into public.scales (name, offset_kg) values ('Studio', 0.6);
insert into public.weigh_ins (scale_id, measured_on, measured_at, weight_kg) values
  (tests.scale('Zuhause'), '2026-11-25', '2026-11-25 07:00+01', 82.0),
  (null, '2026-11-27', '2026-11-27 07:00+01', 81.0),
  (tests.scale('Zuhause'), '2026-12-01', '2026-12-01 07:00+01', 80.0),
  (tests.scale('Studio'), '2026-12-01', '2026-12-01 19:00+01', 81.0),
  (tests.scale('Zuhause'), '2026-12-03', '2026-12-03 07:00+01', 79.8),
  (tests.scale('Zuhause'), '2026-12-04', '2026-12-04 07:00+01', 79.5),
  (tests.scale('Studio'), '2026-12-04', '2026-12-04 19:00+01', 80.0);

-- The owner (no settings row yet)
select results_eq(
  $$select on_date, change_pct, trend_kg
      from public.weight_progress('11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-04')$$,
  $$values ('2026-12-01'::date, 0.00::numeric, 81.07::numeric),
           ('2026-12-03'::date, -0.91::numeric, 80.33::numeric),
           ('2026-12-04'::date, -1.54::numeric, 79.82::numeric)$$,
  'progress: change against the first day''s trend, the first day 0');
select results_eq(
  $$select on_date, change_pct
      from public.weight_progress('11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-04')$$,
  $$select on_date,
           round((trend_kg - first_value(trend_kg) over (order by on_date))
                 / first_value(trend_kg) over (order by on_date) * 100, 2)
      from public.weight_days('11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-04')$$,
  'progress is (trend − start trend) / start trend of weight_days');
select results_eq(
  $$select on_date, change_pct
      from public.weight_progress('11111111-1111-4111-8111-111111111111', null, '2026-12-31')
     limit 2$$,
  $$values ('2026-11-25'::date, 0.00::numeric), ('2026-11-27'::date, -0.61::numeric)$$,
  'without a start: from the first entry');
select results_eq(
  $$select on_date, trend_kg
      from public.weight_progress('11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-04')$$,
  $$select on_date, trend_kg
      from public.weight_days('11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-04')$$,
  'the same trend as weight_days');
select is_empty(
  $$select * from public.weight_progress('11111111-1111-4111-8111-111111111111', '2026-12-05', '2026-12-31')$$,
  'no days with entries: no rows');

-- The owner's full summary, the same at every level (checked again further down).
create temporary table owner_summary as
  select * from public.weight_summary('11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-04');
grant select on owner_summary to authenticated;
select results_eq(
  $$select current_trend_kg, current_on, start_trend_kg, start_on, change_kg, change_pct,
           latest_kg, latest_adjusted_kg, latest_scale_id, latest_on, days_with_entries, share
      from owner_summary$$,
  $$values (79.82::numeric, '2026-12-04'::date, 81.07::numeric, '2026-12-01'::date, -1.25::numeric,
            -1.54::numeric, 80.00::numeric, 79.40::numeric, tests.scale('Studio'), '2026-12-04'::date,
            3, 'own'::text)$$,
  'owner: everything, share "own"');

-- ---------------------------------------------------------------------------
-- private (default)
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';
select is_empty(
  $$select * from public.weight_progress('11111111-1111-4111-8111-111111111111', null, '2026-12-31')$$,
  'private: same group gets no progress');
select results_eq(
  $$select * from public.weight_summary('11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-04')$$,
  $$values (null::numeric, null::date, null::numeric, null::date, null::numeric, null::numeric,
            null::numeric, null::numeric, null::uuid, null::date, 0, null::text)$$,
  'private: an empty summary, share null');
select results_eq(
  $$select * from public.weight_summary('11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-04')$$,
  $$select * from public.weight_summary('33333333-3333-4333-8333-333333333333', '2026-12-01', '2026-12-04')$$,
  'private: just like a stranger without data');
select is_empty(
  $$select * from public.weight_days('11111111-1111-4111-8111-111111111111', null, '2026-12-31')$$,
  'private: no day values');
select is((select count(*) from public.weigh_ins), 0::bigint, 'private: no weigh-ins');
select is((select count(*) from public.scales), 0::bigint, 'private: no scales');

-- a1 shares the change in %, through the usual settings upsert
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select throws_ok(
  $$insert into public.body_settings (weight_share) values ('everything')$$,
  '23514', null, 'the share level is private, percent or kg');
insert into public.body_settings (weight_share) values ('percent')
  on conflict (user_id) do update set weight_share = excluded.weight_share;
select is((select weight_share from public.body_settings), 'percent', 'the owner sets the level');

-- ---------------------------------------------------------------------------
-- percent
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';
select results_eq(
  $$select on_date, change_pct, trend_kg
      from public.weight_progress('11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-04')$$,
  $$values ('2026-12-01'::date, 0.00::numeric, null::numeric),
           ('2026-12-03'::date, -0.91::numeric, null),
           ('2026-12-04'::date, -1.54::numeric, null)$$,
  'percent: the change in %, no kg');
select results_eq(
  $$select * from public.weight_summary('11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-04')$$,
  $$values (null::numeric, '2026-12-04'::date, null::numeric, '2026-12-01'::date, null::numeric,
            -1.54::numeric, null::numeric, null::numeric, null::uuid, null::date, 0, 'percent'::text)$$,
  'percent: summary with the change in % and its days only');
select is(tests.kg_columns('11111111-1111-4111-8111-111111111111'), 0::bigint,
  'percent: not a single kg value, entry or count');
select is(
  (select count(*) from public.weight_progress('11111111-1111-4111-8111-111111111111', null, '2026-12-31')
    where trend_kg is not null), 0::bigint,
  'percent: no kg over all time either');
select is_empty(
  $$select * from public.weight_days('11111111-1111-4111-8111-111111111111', null, '2026-12-31')$$,
  'percent: no day values');
select is((select count(*) from public.weigh_ins), 0::bigint, 'percent: no weigh-ins');
select is((select count(*) from public.scales), 0::bigint, 'percent: no scales');
select is((select count(*) from public.body_settings), 0::bigint, 'percent: no settings of others');
update public.body_settings set weight_share = 'private';

set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select is_empty(
  $$select * from public.weight_progress('11111111-1111-4111-8111-111111111111', null, '2026-12-31')$$,
  'percent: another group gets no progress');
select results_eq(
  $$select * from public.weight_summary('11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-04')$$,
  $$select * from public.weight_summary('22222222-2222-4222-8222-222222222222', '2026-12-01', '2026-12-04')$$,
  'percent: another group gets an empty summary');
select is_empty(
  $$select * from public.weight_days('11111111-1111-4111-8111-111111111111', null, '2026-12-31')$$,
  'percent: another group gets no day values');

set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select is((select weight_share from public.body_settings), 'percent', 'others cannot change the level');
select results_eq(
  $$select * from public.weight_summary('11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-04')$$,
  $$select * from owner_summary$$,
  'percent: the owner''s summary is unchanged');
select is(
  (select count(*) from public.weight_progress('11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-04')
    where trend_kg is not null), 3::bigint,
  'percent: the owner still gets the kg curve');

-- ---------------------------------------------------------------------------
-- kg
-- ---------------------------------------------------------------------------
update public.body_settings set weight_share = 'kg';

set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';
select results_eq(
  $$select on_date, change_pct, trend_kg
      from public.weight_progress('11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-04')$$,
  $$values ('2026-12-01'::date, 0.00::numeric, 81.07::numeric),
           ('2026-12-03'::date, -0.91::numeric, 80.33::numeric),
           ('2026-12-04'::date, -1.54::numeric, 79.82::numeric)$$,
  'kg: the change in % and the trend in kg');
select results_eq(
  $$select * from public.weight_summary('11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-04')$$,
  $$values (79.82::numeric, '2026-12-04'::date, 81.07::numeric, '2026-12-01'::date, -1.25::numeric,
            -1.54::numeric, null::numeric, null::numeric, null::uuid, null::date, 0, 'kg'::text)$$,
  'kg: the trend and change in kg, still no single entry, scale or count');
select is_empty(
  $$select * from public.weight_days('11111111-1111-4111-8111-111111111111', null, '2026-12-31')$$,
  'kg: still no day values');
select is((select count(*) from public.weigh_ins), 0::bigint, 'kg: no weigh-ins');
select is((select count(*) from public.scales), 0::bigint, 'kg: no scales');
select is((select count(*) from public.body_settings), 0::bigint, 'kg: no settings of others');
select is_empty(
  $$select * from public.scale_offset_suggestion(tests.scale('Studio'))$$,
  'kg: no offset suggestion');

set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select is_empty(
  $$select * from public.weight_progress('11111111-1111-4111-8111-111111111111', null, '2026-12-31')$$,
  'kg: another group gets no progress');
select is(tests.kg_columns('11111111-1111-4111-8111-111111111111'), 0::bigint,
  'kg: another group gets no kg value');
select is(
  (select share from public.weight_summary('11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-04')),
  null, 'kg: another group does not see that a1 shares');
select is(
  (select change_pct from public.weight_summary('11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-04')),
  null, 'kg: another group gets no change in %');
select is_empty(
  $$select * from public.weight_days('11111111-1111-4111-8111-111111111111', null, '2026-12-31')$$,
  'kg: another group gets no day values');

set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select results_eq(
  $$select * from public.weight_summary('11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-04')$$,
  $$select * from owner_summary$$,
  'kg: the owner''s summary is unchanged');
select results_eq(
  $$select on_date, weight_kg, entries from public.weight_days('11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-04')$$,
  $$values ('2026-12-01'::date, 80.20::numeric, 2), ('2026-12-03'::date, 79.80::numeric, 1),
           ('2026-12-04'::date, 79.45::numeric, 2)$$,
  'kg: the owner still gets the day values');

-- ---------------------------------------------------------------------------
-- Back to private: hidden again
-- ---------------------------------------------------------------------------
insert into public.body_settings (weight_share) values ('private')
  on conflict (user_id) do update set weight_share = excluded.weight_share;

set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';
select is_empty(
  $$select * from public.weight_progress('11111111-1111-4111-8111-111111111111', null, '2026-12-31')$$,
  'private again: no progress');
select results_eq(
  $$select * from public.weight_summary('11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-04')$$,
  $$select * from public.weight_summary('33333333-3333-4333-8333-333333333333', '2026-12-01', '2026-12-04')$$,
  'private again: an empty summary');
select is_empty(
  $$select * from public.weight_days('11111111-1111-4111-8111-111111111111', null, '2026-12-31')$$,
  'private again: no day values');

set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select results_eq(
  $$select * from public.weight_summary('11111111-1111-4111-8111-111111111111', '2026-12-01', '2026-12-04')$$,
  $$select * from owner_summary$$,
  'private again: the owner''s summary is unchanged');

-- ---------------------------------------------------------------------------
-- A person who shares but has no data looks like it to others; without a group: nothing
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';
insert into public.body_settings (weight_share) values ('percent');
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select results_eq(
  $$select current_on, change_pct, days_with_entries, share
      from public.weight_summary('22222222-2222-4222-8222-222222222222', null, '2026-12-31')$$,
  $$values (null::date, null::numeric, 0, 'percent'::text)$$,
  'shared without data: nulls, share percent');
select is_empty(
  $$select * from public.weight_progress('22222222-2222-4222-8222-222222222222', null, '2026-12-31')$$,
  'shared without data: no progress');

-- Not signed in: nothing
reset role;
set local role anon;
select throws_ok(
  $$select * from public.weight_progress('11111111-1111-4111-8111-111111111111', null, '2026-12-31')$$,
  '42501', null, 'anon cannot call weight_progress');
select throws_ok(
  $$select * from public.weight_summary('11111111-1111-4111-8111-111111111111', null, '2026-12-31')$$,
  '42501', null, 'anon cannot call weight_summary');
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';
select throws_ok(
  $$select * from private.weight_trend('11111111-1111-4111-8111-111111111111', null, '2026-12-31')$$,
  '42501', null, 'the unchecked trend is not callable');
select throws_ok(
  $$select private.weight_view('11111111-1111-4111-8111-111111111111')$$,
  '42501', null, 'nor the level check');
reset role;

select is((select count(*) from public.body_settings where weight_share = 'private'), 1::bigint,
  'a1 is private at the end');
select is((select count(*) from public.weigh_ins), 7::bigint, 'all of a1''s weigh-ins are still there');
select is((select count(*) from public.body_settings), 2::bigint, 'two settings rows');

select * from finish();
rollback;
