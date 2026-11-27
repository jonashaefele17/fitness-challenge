-- Trainings per week: a week counts at most up to its target, so nothing can be saved up.
-- Goal of a1: minimum 3, target 4, four weeks from Monday 30.11.2026.

begin;
create extension if not exists pgtap with schema extensions;

select plan(4);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'a1@test.local');
insert into public.profiles (id, display_name, color) values
  ('11111111-1111-4111-8111-111111111111', 'A1', 'person-1');

create schema tests;
grant usage on schema tests to authenticated;
-- Finished trainings of a1 on the first p_count days from p_monday.
create function tests.week(p_monday date, p_count integer) returns void
language sql as $$
  insert into public.workouts (user_id, training_type_id, status, started_at, ended_at)
  select '11111111-1111-4111-8111-111111111111',
         (select id from public.training_types where name = 'Studio' and owner_id is null),
         'finished',
         (p_monday + n + time '10:00') at time zone 'Europe/Berlin',
         (p_monday + n + time '11:00') at time zone 'Europe/Berlin'
    from generate_series(0, p_count - 1) n
$$;

-- Goal 1: weeks of 6, 6, 0, 0 trainings. Goal 2 (from 28.12.): weeks of 4, 4, 2, 4.
select tests.week('2026-11-30', 6);
select tests.week('2026-12-07', 6);
select tests.week('2026-12-28', 4);
select tests.week('2027-01-04', 4);
select tests.week('2027-01-11', 2);
select tests.week('2027-01-18', 4);

set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

select public.create_goal('90000000-0000-4000-8000-000000000001', 'trainings_per_week',
  '2026-11-30', '2026-12-27', null, 3, 4);
select public.create_goal('90000000-0000-4000-8000-000000000002', 'trainings_per_week',
  '2026-12-28', '2027-01-24', null, 3, 4);

select results_eq(
  $$select status, current_value, on_track
      from public.goal_progress(null, '2026-12-28', 'Europe/Berlin', false,
                                '90000000-0000-4000-8000-000000000001')$$,
  $$values ('below_min', 2.0::numeric, false)$$,
  '6, 6, 0, 0 counts as 4 + 4: below the minimum, nothing saved up');
select results_eq(
  $$select progress_pct
      from public.goal_progress(null, '2026-12-28', 'Europe/Berlin', false,
                                '90000000-0000-4000-8000-000000000001')$$,
  $$values (50.0::numeric)$$, '8 of the 16 the target asked for');
select results_eq(
  $$select status, current_value, on_track
      from public.goal_progress(null, '2027-01-25', 'Europe/Berlin', false,
                                '90000000-0000-4000-8000-000000000002')$$,
  $$values ('min_reached', 3.5::numeric, true)$$,
  '4, 4, 2, 4: full weeks soften the weak one');
select results_eq(
  $$select min_met, target_met
      from public.goal_progress(null, '2027-01-25', 'Europe/Berlin', false,
                                '90000000-0000-4000-8000-000000000002')$$,
  $$values (3, 3)$$, 'the weeks are still counted one by one');

select * from finish();
rollback;
