-- Weigh-in reminder (7a): on the chosen weekdays at the chosen time, only without an entry
-- for today, once a day, never late; choosing it switches its category on; the target is
-- only visible to its owner; nobody else gets it.
--   a1 wants a reminder on Tuesdays at 07:00 · a2 is in group A too

begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

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

create schema tests;
create function tests.notes() returns bigint language sql as $$
  select count(*) from public.notifications where event = 'weigh_reminder'
$$;

set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
insert into public.body_settings (weigh_reminder_days, weigh_reminder_at) values ('{2}', '07:00');
reset role;

select is(
  (select enabled from public.notification_category_prefs
    where user_id = '11111111-1111-4111-8111-111111111111' and category = 'body'),
  true, 'choosing weigh days switches the reminders on');

-- Tuesday 1 December, 06:50 in Berlin: not yet
select private.enqueue_body_reminders('2026-12-01 05:50:00+00');
select is(tests.notes(), 0::bigint, 'not before the time');

-- 07:10 in Berlin (06:10 UTC): nothing entered today
select private.enqueue_body_reminders('2026-12-01 06:10:00+00');
select is(tests.notes(), 1::bigint, 'reminded on the chosen weekday without an entry');
select results_eq(
  $$select recipient_id, category, target_type, target_id, data ->> 'preview'
      from public.notifications where event = 'weigh_reminder'$$,
  $$values ('11111111-1111-4111-8111-111111111111'::uuid, 'body'::text, 'body'::text,
            '11111111-1111-4111-8111-111111111111'::uuid, 'Heute noch nicht gewogen'::text)$$,
  'in the body category, pointing at the own body figures');
select private.enqueue_body_reminders('2026-12-01 06:20:00+00');
select is(tests.notes(), 1::bigint, 'only once a day');

-- Wednesday: not a weigh day
select private.enqueue_body_reminders('2026-12-02 06:10:00+00');
select is(tests.notes(), 1::bigint, 'not on another weekday');

-- Tuesday 8 December: already weighed (a weigh-in the day before does not count)
insert into public.weigh_ins (user_id, measured_on, weight_kg) values
  ('11111111-1111-4111-8111-111111111111', '2026-12-07', 80),
  ('11111111-1111-4111-8111-111111111111', '2026-12-08', 80);
select private.enqueue_body_reminders('2026-12-08 06:10:00+00');
select is(tests.notes(), 1::bigint, 'not when already weighed today');

-- Tuesday 15 December, 10:30 in Berlin: too late
select private.enqueue_body_reminders('2026-12-15 09:30:00+00');
select is(tests.notes(), 1::bigint, 'never late');

-- Tuesday 22 December: the time zone counts (07:10 in New York)
insert into public.notification_prefs (user_id, time_zone)
values ('11111111-1111-4111-8111-111111111111', 'America/New_York')
on conflict (user_id) do update set time_zone = excluded.time_zone;
select private.enqueue_body_reminders('2026-12-22 06:10:00+00');
select is(tests.notes(), 1::bigint, 'at 01:10 in New York: not yet');
select private.enqueue_body_reminders('2026-12-22 12:10:00+00');
select is(tests.notes(), 2::bigint, 'at 07:10 in New York: reminded');

select is((select count(*) from public.notifications
            where recipient_id <> '11111111-1111-4111-8111-111111111111'),
  0::bigint, 'nobody else gets it');
select ok(
  private.can_view_target('body', '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111')
  and not private.can_view_target('body', '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222'),
  'the target is visible to its owner only');

select * from finish();
rollback;
