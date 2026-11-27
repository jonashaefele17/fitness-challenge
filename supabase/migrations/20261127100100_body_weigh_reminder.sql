-- Baustein 7a (notifications, social): the weigh-in reminder.
--   On the person's chosen weekdays at their time (body_settings), if nothing is entered
--   for today yet ("Wiegen · Heute noch nicht gewogen").
-- Only once per day, never late (more than 2 hours after the time). Every 5 minutes; local
-- time from the person's time zone. Quiet hours and the category's on/off are applied when
-- pushing, as for all notifications. Body knows nothing of notifications; this reads body.

insert into public.notification_categories
  (key, label, description, sort, in_important, in_standard) values
  ('body', 'Körper', 'Erinnerung ans Wiegen an deinen Wiegetagen.', 90, false, true);

-- A person's body figures as a notification target (target_id: the person): only they see it.
create function private.body_visible(p_target_id uuid, p_group_id uuid, p_viewer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_target_id = p_viewer_id;
$$;

create function private.body_owner(p_target_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id from auth.users u where u.id = p_target_id;
$$;

insert into public.target_types (key, module, can_view_fn, owner_fn) values
  ('body', 'body', 'private.body_visible', 'private.body_owner');

-- What was sent (so nothing goes out twice a day).
create table public.body_reminder_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  on_date date not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, on_date)
);
alter table public.body_reminder_log enable row level security;
revoke all on public.body_reminder_log from anon, authenticated;

create function private.enqueue_body_reminders(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with people as (
    select s.user_id, s.weigh_reminder_days, s.weigh_reminder_at,
           (p_now at time zone coalesce(np.time_zone, 'Europe/Berlin')) as local,
           -- Notifications belong to a group: the person's first one.
           (select gm.group_id from public.group_members gm
             where gm.user_id = s.user_id order by gm.joined_at limit 1) as group_id
      from public.body_settings s
      left join public.notification_prefs np on np.user_id = s.user_id
     where s.weigh_reminder_at is not null and cardinality(s.weigh_reminder_days) > 0
  ),
  due as (
    select p.user_id, p.group_id, p.local::date as day
      from people p
     where p.group_id is not null
       and extract(isodow from p.local)::smallint = any (p.weigh_reminder_days)
       and p.local::time >= p.weigh_reminder_at
       and p.local::time - p.weigh_reminder_at < interval '2 hours'
       and not exists (select 1 from public.weigh_ins w
                        where w.user_id = p.user_id and w.measured_on = p.local::date)
       and not exists (select 1 from public.body_reminder_log l
                        where l.user_id = p.user_id and l.on_date = p.local::date)
  ),
  sent as (
    insert into public.notifications
      (recipient_id, group_id, category, event, target_type, target_id, data)
    select d.user_id, d.group_id, 'body', 'weigh_reminder', 'body', d.user_id,
           jsonb_build_object('preview', 'Heute noch nicht gewogen', 'day', d.day)
      from due d
    returning recipient_id, data
  )
  insert into public.body_reminder_log (user_id, on_date)
  select recipient_id, (data ->> 'day')::date from sent;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function private.enqueue_body_reminders(timestamptz) from public, anon, authenticated;

-- Choosing weigh days and a time is wanting the reminder: its category is switched on.
-- Only when the reminder is newly set, so a later change of the days or the time does not
-- switch a category back on that the person turned off in the notification settings.
create function private.on_body_settings_set()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.weigh_reminder_at is not null and cardinality(new.weigh_reminder_days) > 0
     and (tg_op = 'INSERT'
          or old.weigh_reminder_at is null or cardinality(old.weigh_reminder_days) = 0) then
    insert into public.notification_category_prefs (user_id, category, enabled)
    values (new.user_id, 'body', true)
    on conflict (user_id, category) do update set enabled = true;
  end if;
  return null;
end;
$$;

create trigger body_settings_after_write_notifications
  after insert or update on public.body_settings
  for each row execute function private.on_body_settings_set();

select cron.schedule('body-reminders', '*/5 * * * *', $cron$ select private.enqueue_body_reminders(); $cron$);
