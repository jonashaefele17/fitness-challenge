-- Zwischenstand reminder (7c): when a check-in is due, at the chosen time, never late, once
-- per cycle (no nagging on the following days), not without a rhythm, not after the
-- check-in; choosing a rhythm and a time switches the category on only when newly set; its
-- own target type, visible to the owner only.
--   a1 wants a check-in every 4 weeks at 08:00 · a2 is in group A too (rhythm, no time)

begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

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
  select count(*) from public.notifications where event = 'body_checkin_reminder'
$$;
create function tests.body_enabled(p_user uuid) returns boolean language sql as $$
  select enabled from public.notification_category_prefs where user_id = p_user and category = 'body'
$$;

-- a1: a rhythm first (no time: no reminder wanted yet), then the time
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
insert into public.body_settings (checkin_every_weeks) values (4);
reset role;
select is(tests.body_enabled('11111111-1111-4111-8111-111111111111'), null,
  'a rhythm without a time does not touch the category');

set local role authenticated;
update public.body_settings set checkin_reminder_at = '08:00';
reset role;
select is(tests.body_enabled('11111111-1111-4111-8111-111111111111'), true,
  'rhythm and time newly set: the category is switched on');

-- turned off in the notification settings; changing the rhythm keeps it off
update public.notification_category_prefs set enabled = false
 where user_id = '11111111-1111-4111-8111-111111111111' and category = 'body';
set local role authenticated;
update public.body_settings set checkin_every_weeks = 6, checkin_reminder_at = '08:30';
update public.body_settings set checkin_every_weeks = 4, checkin_reminder_at = '08:00';
reset role;
select is(tests.body_enabled('11111111-1111-4111-8111-111111111111'), false,
  'a later change does not switch it back on');
update public.notification_category_prefs set enabled = true
 where user_id = '11111111-1111-4111-8111-111111111111' and category = 'body';

-- a2: a rhythm but no time
set local role authenticated;
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';
insert into public.body_settings (checkin_every_weeks) values (4);
reset role;

-- Tuesday 1 December, 07:50 in Berlin: due (no check-in yet), but not the time
select private.enqueue_body_checkin_reminders('2026-12-01 06:50:00+00');
select is(tests.notes(), 0::bigint, 'not before the time');

-- 08:10 in Berlin
select private.enqueue_body_checkin_reminders('2026-12-01 07:10:00+00');
select is(tests.notes(), 1::bigint, 'reminded when due at the time');
select results_eq(
  $$select recipient_id, category, target_type, target_id, data ->> 'preview', data ->> 'due_on'
      from public.notifications where event = 'body_checkin_reminder'$$,
  $$values ('11111111-1111-4111-8111-111111111111'::uuid, 'body'::text, 'body_checkin'::text,
            '11111111-1111-4111-8111-111111111111'::uuid, 'Zeit für deinen Zwischenstand'::text,
            '2026-12-01'::text)$$,
  'in the body category, pointing at the own check-in');
select private.enqueue_body_checkin_reminders('2026-12-01 07:20:00+00');
select is(tests.notes(), 1::bigint, 'not twice for the same due date');
select private.enqueue_body_checkin_reminders('2026-12-02 07:10:00+00');
select is(tests.notes(), 1::bigint, 'not again on the next day while still open');

-- Done on 3 December: next due 31 December
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select public.save_body_checkin('2026-12-03', '{"bauch": 90}');
reset role;
select private.enqueue_body_checkin_reminders('2026-12-04 07:10:00+00');
select is(tests.notes(), 1::bigint, 'not after the check-in was done');
select private.enqueue_body_checkin_reminders('2026-12-30 07:10:00+00');
select is(tests.notes(), 1::bigint, 'not before the next due date');

-- 31 December, 10:30 in Berlin: too late; then 1 January at 08:10 (still due, not yet sent)
select private.enqueue_body_checkin_reminders('2026-12-31 09:30:00+00');
select is(tests.notes(), 1::bigint, 'never late');
select private.enqueue_body_checkin_reminders('2027-01-01 07:10:00+00');
select is(tests.notes(), 2::bigint, 'the next cycle is reminded once');
select is((select data ->> 'due_on' from public.notifications
            where event = 'body_checkin_reminder' order by created_at desc, data ->> 'due_on' desc limit 1),
  '2026-12-31', 'with its due date');

-- Skipped on 2 January: the next cycle starts; turning the rhythm off: nothing at all
set local role authenticated;
select public.skip_body_checkin('2027-01-02');
update public.body_settings set checkin_every_weeks = null;
reset role;
select private.enqueue_body_checkin_reminders('2027-01-30 07:10:00+00');
select is(tests.notes(), 2::bigint, 'not without a rhythm');

select is((select count(*) from public.notifications
            where recipient_id <> '11111111-1111-4111-8111-111111111111'),
  0::bigint, 'nobody else gets it (a rhythm without a time: no push)');
select is((select count(*) from public.notifications where event = 'weigh_reminder'),
  0::bigint, 'the weigh reminder is not triggered by it');
select ok(
  private.can_view_target('body_checkin', '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111')
  and not private.can_view_target('body_checkin', '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222'),
  'the target is visible to its owner only');

select * from finish();
rollback;
