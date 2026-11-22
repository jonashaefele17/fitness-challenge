-- Reminders (6c): the check-in only when something of that time of day is open, supplements
-- only when not ticked; once a day; never during a pause; setting a time switches its
-- category on; nobody else gets them.
--   a1 has habits and is in group A · a2 is in group A too

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

create schema tests;
create function tests.notes(p_event text) returns bigint language sql as $$
  select count(*) from public.notifications where event = p_event
$$;

set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
-- Screen-Time in the evening, sleep in the morning, supplements with Kreatin at 08:00
select public.save_habit(null, (select id from public.habit_templates where key = 'screen_time'), '2026-11-30', '{}');
select public.save_habit(null, (select id from public.habit_templates where key = 'sleep'), '2026-11-30', '{}');
select public.save_habit(null, (select id from public.habit_templates where key = 'supplements'), '2026-11-30',
  '{"options":[{"key":"creatine","label":"Kreatin","remindAt":"08:00"},{"key":"vitamin_d","label":"Vitamin D"}]}');
insert into public.habit_reminders (morning_at, evening_at) values (null, '21:00');
reset role;

select is(
  (select enabled from public.notification_category_prefs
    where user_id = '11111111-1111-4111-8111-111111111111' and category = 'checkin_reminder'),
  true, 'setting a check-in time switches its reminders on');
select is(
  (select enabled from public.notification_category_prefs
    where user_id = '11111111-1111-4111-8111-111111111111' and category = 'supplements'),
  true, 'and a supplement time the supplement reminders');

-- Tuesday 1 December, 21:10 in Berlin (20:10 UTC): Screen-Time is open
select private.enqueue_habit_reminders('2026-12-01 20:10:00+00');
select is(tests.notes('checkin_reminder'), 1::bigint, 'the evening check-in is reminded');
select is((select data ->> 'preview' from public.notifications where event = 'checkin_reminder'),
  'Screen-Time', 'naming what is open (only the evening habits)');
select private.enqueue_habit_reminders('2026-12-01 20:20:00+00');
select is(tests.notes('checkin_reminder'), 1::bigint, 'only once a day');

-- Wednesday: Screen-Time already entered – nothing open, nothing sent
insert into public.habit_entries (habit_id, on_date, value)
select h.id, '2026-12-02', '{"minutes":60}' from public.habits h
  join public.habit_versions v on v.habit_id = h.id where v.name = 'Screen-Time';
select private.enqueue_habit_reminders('2026-12-02 20:10:00+00');
select is(tests.notes('checkin_reminder'), 1::bigint, 'nothing open, no reminder');

-- Too late (more than 2 hours after the time): nothing
select private.enqueue_habit_reminders('2026-12-03 23:30:00+00');
select is(tests.notes('checkin_reminder'), 1::bigint, 'never late');

-- Supplements: Thursday 08:15 in Berlin, Kreatin not ticked
select private.enqueue_habit_reminders('2026-12-03 07:15:00+00');
select is((select string_agg(data ->> 'preview', ',') from public.notifications where event = 'supplement_reminder'),
  'Kreatin', 'an untaken supplement is reminded at its time');

-- Friday: Kreatin ticked already – nothing
insert into public.habit_entries (habit_id, on_date, value)
select h.id, '2026-12-04', '{"checked":["creatine"]}' from public.habits h
  join public.habit_versions v on v.habit_id = h.id where v.name = 'Supplements';
select private.enqueue_habit_reminders('2026-12-04 07:15:00+00');
select is(tests.notes('supplement_reminder'), 1::bigint, 'a ticked one is not');

-- In a pause: nothing at all
insert into public.habit_pauses (user_id, from_date, to_date)
values ('11111111-1111-4111-8111-111111111111', '2026-12-05', '2026-12-06');
select private.enqueue_habit_reminders('2026-12-05 20:10:00+00');
select is((select count(*) from public.notifications where recipient_id <> '11111111-1111-4111-8111-111111111111'
            or (data ->> 'day')::date = '2026-12-05'),
  0::bigint, 'no reminders in a pause, none for anyone else');

select * from finish();
rollback;
