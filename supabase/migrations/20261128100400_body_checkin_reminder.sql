-- Baustein 7c (notifications, social): the reminder for the Zwischenstand.
--   When a check-in is due (private.body_checkin_rhythm) and the person's local time has
--   reached checkin_reminder_at, not more than 2 hours late. Once per rhythm cycle: a cycle
--   ends with the next check-in (done or skipped), so a missed one does not nag every day,
--   and the very first one (due "today" every day until there is a check-in) goes out once.
-- Same machinery as the weigh reminder: category "body", every 5 minutes, quiet hours and
-- the category's on/off applied when pushing. Its own target type "body_checkin" (the
-- person, like "body") so the click opens the check-in, not the weigh-in, and the push tag
-- differs from the weigh reminder's. Body knows nothing of notifications; this reads body.

update public.notification_categories
   set description = 'Erinnerung ans Wiegen und an den Zwischenstand.'
 where key = 'body';

insert into public.target_types (key, module, can_view_fn, owner_fn) values
  ('body_checkin', 'body', 'private.body_visible', 'private.body_owner');

-- What was sent: one row per person and due date.
create table public.body_checkin_reminder_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  due_on date not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, due_on)
);
alter table public.body_checkin_reminder_log enable row level security;
revoke all on public.body_checkin_reminder_log from anon, authenticated;

create function private.enqueue_body_checkin_reminders(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with people as (
    select s.user_id, s.checkin_reminder_at,
           (p_now at time zone coalesce(np.time_zone, 'Europe/Berlin')) as local,
           -- Notifications belong to a group: the person's first one.
           (select gm.group_id from public.group_members gm
             where gm.user_id = s.user_id order by gm.joined_at limit 1) as group_id
      from public.body_settings s
      left join public.notification_prefs np on np.user_id = s.user_id
     where s.checkin_every_weeks is not null and s.checkin_reminder_at is not null
  ),
  due as (
    select p.user_id, p.group_id, r.next_due_on
      from people p
      cross join lateral private.body_checkin_rhythm(p.user_id, p.local::date) r
     where p.group_id is not null
       and r.due
       and p.local::time >= p.checkin_reminder_at
       and p.local::time - p.checkin_reminder_at < interval '2 hours'
       -- Nothing sent yet in this cycle (since the latest check-in).
       and not exists (select 1 from public.body_checkin_reminder_log l
                        where l.user_id = p.user_id
                          and (r.last_on is null or l.due_on > r.last_on))
  ),
  sent as (
    insert into public.notifications
      (recipient_id, group_id, category, event, target_type, target_id, data)
    select d.user_id, d.group_id, 'body', 'body_checkin_reminder', 'body_checkin', d.user_id,
           jsonb_build_object('preview', 'Zeit für deinen Zwischenstand', 'due_on', d.next_due_on)
      from due d
    returning recipient_id, data
  )
  insert into public.body_checkin_reminder_log (user_id, due_on)
  select recipient_id, (data ->> 'due_on')::date from sent;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function private.enqueue_body_checkin_reminders(timestamptz)
  from public, anon, authenticated;

-- Choosing a reminder switches the "body" category on – only when it is newly set (weigh
-- days and a time, or a check-in rhythm and a time, from unset to set), so a later change
-- does not switch a category back on that the person turned off.
create or replace function private.on_body_settings_set()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.weigh_reminder_at is not null and cardinality(new.weigh_reminder_days) > 0
      and (tg_op = 'INSERT'
           or old.weigh_reminder_at is null or cardinality(old.weigh_reminder_days) = 0))
     or (new.checkin_every_weeks is not null and new.checkin_reminder_at is not null
         and (tg_op = 'INSERT'
              or old.checkin_every_weeks is null or old.checkin_reminder_at is null)) then
    insert into public.notification_category_prefs (user_id, category, enabled)
    values (new.user_id, 'body', true)
    on conflict (user_id, category) do update set enabled = true;
  end if;
  return null;
end;
$$;

select cron.schedule('body-checkin-reminders', '*/5 * * * *',
  $cron$ select private.enqueue_body_checkin_reminders(); $cron$);
