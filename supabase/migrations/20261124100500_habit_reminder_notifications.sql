-- Baustein 6c (notifications, social): reminders of the check-in and of supplements.
--   Check-in: at the person's morning/evening time, if habits of that time of day are still
--   open today ("Check-in: Screen-Time, Fokuszeit").
--   Supplements: at an item's own time, if it is not ticked today ("Kreatin").
-- Only once per day and kind, never during a pause, never late (more than 2 hours after the
-- time). Every 5 minutes; local time from the person's time zone. Quiet hours and the
-- categories' on/off are applied when pushing, as for all notifications.

-- A habit as a notification target: only its owner sees it.
create function private.habit_visible(p_target_id uuid, p_group_id uuid, p_viewer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.habits h where h.id = p_target_id and h.user_id = p_viewer_id);
$$;

create function private.habit_owner(p_target_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select h.user_id from public.habits h where h.id = p_target_id;
$$;

insert into public.target_types (key, module, can_view_fn, owner_fn) values
  ('habit', 'habits', 'private.habit_visible', 'private.habit_owner');

-- What was sent (so nothing goes out twice a day).
create table public.habit_reminder_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- checkin | supplement
  kind text not null,
  -- checkin: morning | evening; supplement: the item's key
  key text not null,
  on_date date not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, kind, key, on_date)
);
alter table public.habit_reminder_log enable row level security;
revoke all on public.habit_reminder_log from anon, authenticated;

create function private.enqueue_habit_reminders(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  v_n integer;
begin
  -- Everyone's local time and first group (notifications belong to a group).
  create temporary table if not exists reminder_people on commit drop as
  select u.id as user_id,
         (p_now at time zone coalesce(np.time_zone, 'Europe/Berlin')) as local,
         (select gm.group_id from public.group_members gm
           where gm.user_id = u.id order by gm.joined_at limit 1) as group_id
    from auth.users u
    left join public.notification_prefs np on np.user_id = u.id
   where exists (select 1 from public.habits h where h.user_id = u.id and h.archived_at is null);
  delete from reminder_people where group_id is null
     or exists (select 1 from public.habit_pauses p
                 where p.user_id = reminder_people.user_id
                   and local::date between p.from_date and p.to_date);

  -- Check-in: habits of that time of day still open today.
  with due as (
    select p.user_id, p.group_id, p.local::date as day, k.kind, k.at
      from reminder_people p
      join public.habit_reminders r on r.user_id = p.user_id
     cross join lateral (values ('morning', r.morning_at), ('evening', r.evening_at)) k(kind, at)
     where k.at is not null
       and p.local::time >= k.at and p.local::time - k.at < interval '2 hours'
       and not exists (select 1 from public.habit_reminder_log l
                        where l.user_id = p.user_id and l.kind = 'checkin'
                          and l.key = k.kind and l.on_date = p.local::date)
  ),
  open as (
    select d.user_id, d.group_id, d.day, d.kind,
           (array_agg(h.id order by h.sort))[1] as habit_id,
           string_agg(v.name, ', ' order by h.sort) as names
      from due d
      join public.habits h on h.user_id = d.user_id and h.archived_at is null
     cross join lateral (
       select * from public.habit_versions v
        where v.habit_id = h.id and v.valid_from <= d.day
        order by v.valid_from desc limit 1
     ) v
     where v.time_of_day = d.kind and v.source <> 'training'
       and (v.frequency = 'daily'
            or (v.frequency = 'weekdays' and extract(isodow from d.day)::smallint = any (v.weekdays)))
       and not exists (select 1 from public.habit_entries e where e.habit_id = h.id and e.on_date = d.day)
     group by d.user_id, d.group_id, d.day, d.kind
  ),
  sent as (
    insert into public.notifications
      (recipient_id, group_id, category, event, target_type, target_id, data)
    select o.user_id, o.group_id, 'checkin_reminder', 'checkin_reminder', 'habit', o.habit_id,
           jsonb_build_object('preview', o.names, 'kind', o.kind, 'day', o.day)
      from open o
    returning recipient_id, data
  )
  insert into public.habit_reminder_log (user_id, kind, key, on_date)
  select recipient_id, 'checkin', data ->> 'kind', (data ->> 'day')::date from sent;
  get diagnostics v_n = row_count;
  v_count := v_count + v_n;

  -- Supplements: an item at its own time, if not ticked today.
  with items as (
    select p.user_id, p.group_id, p.local::date as day, h.id as habit_id,
           o ->> 'key' as key, o ->> 'label' as label, (o ->> 'remindAt')::time as at
      from reminder_people p
      join public.habits h on h.user_id = p.user_id and h.archived_at is null
     cross join lateral (
       select * from public.habit_versions v
        where v.habit_id = h.id and v.valid_from <= p.local::date
        order by v.valid_from desc limit 1
     ) v
     cross join lateral jsonb_array_elements(v.options) o
     where v.input_type = 'checklist' and coalesce(o ->> 'remindAt', '') <> ''
       and p.local::time >= (o ->> 'remindAt')::time
       and p.local::time - (o ->> 'remindAt')::time < interval '2 hours'
  ),
  open as (
    select i.* from items i
     where not exists (select 1 from public.habit_entries e
                        where e.habit_id = i.habit_id and e.on_date = i.day
                          and e.value -> 'checked' ? i.key)
       and not exists (select 1 from public.habit_reminder_log l
                        where l.user_id = i.user_id and l.kind = 'supplement'
                          and l.key = i.key and l.on_date = i.day)
  ),
  sent as (
    insert into public.notifications
      (recipient_id, group_id, category, event, target_type, target_id, data)
    select o.user_id, o.group_id, 'supplements', 'supplement_reminder', 'habit', o.habit_id,
           jsonb_build_object('preview', o.label, 'key', o.key, 'day', o.day)
      from open o
    returning recipient_id, data
  )
  insert into public.habit_reminder_log (user_id, kind, key, on_date)
  select recipient_id, 'supplement', data ->> 'key', (data ->> 'day')::date from sent;
  get diagnostics v_n = row_count;
  v_count := v_count + v_n;

  drop table reminder_people;
  return v_count;
end;
$$;

-- Setting a reminder time is wanting the reminder: its category is switched on.
create function private.on_habit_reminders_set()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.morning_at is not null or new.evening_at is not null then
    insert into public.notification_category_prefs (user_id, category, enabled)
    values (new.user_id, 'checkin_reminder', true)
    on conflict (user_id, category) do update set enabled = true;
  end if;
  return null;
end;
$$;

create trigger habit_reminders_after_write_notifications
  after insert or update on public.habit_reminders
  for each row execute function private.on_habit_reminders_set();

create function private.on_supplement_times_set()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.input_type = 'checklist' and exists (
    select 1 from jsonb_array_elements(new.options) o where coalesce(o ->> 'remindAt', '') <> ''
  ) then
    insert into public.notification_category_prefs (user_id, category, enabled)
    select h.user_id, 'supplements', true from public.habits h where h.id = new.habit_id
    on conflict (user_id, category) do update set enabled = true;
  end if;
  return null;
end;
$$;

create trigger habit_versions_after_write_notifications
  after insert or update on public.habit_versions
  for each row execute function private.on_supplement_times_set();

select cron.schedule('habit-reminders', '*/5 * * * *', $cron$ select private.enqueue_habit_reminders(); $cron$);
