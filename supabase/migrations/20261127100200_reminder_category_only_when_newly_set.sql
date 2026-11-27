-- Notifications (social): setting a habit reminder switches its category on only when the
-- reminder is newly set. Before, every later change (another time, an edited checklist)
-- switched a category back on that the person had turned off in the notification settings.

-- Check-in: from "no time at all" to a morning or evening time.
create or replace function private.on_habit_reminders_set()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.morning_at is not null or new.evening_at is not null)
     and (tg_op = 'INSERT' or (old.morning_at is null and old.evening_at is null)) then
    insert into public.notification_category_prefs (user_id, category, enabled)
    values (new.user_id, 'checkin_reminder', true)
    on conflict (user_id, category) do update set enabled = true;
  end if;
  return null;
end;
$$;

create function private.has_reminder_time(p_options jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select exists (
    select 1 from jsonb_array_elements(p_options) o where coalesce(o ->> 'remindAt', '') <> ''
  );
$$;

revoke all on function private.has_reminder_time(jsonb) from public, anon, authenticated;

-- Supplements: the checklist has a time now and had none before (before: the same version
-- when it is edited, otherwise the habit's version before this one).
create or replace function private.on_supplement_times_set()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
begin
  if new.input_type <> 'checklist' or not private.has_reminder_time(new.options) then
    return null;
  end if;
  if tg_op = 'UPDATE' then
    v_before := old.options;
  else
    select v.options into v_before
      from public.habit_versions v
     where v.habit_id = new.habit_id and v.id <> new.id
     order by v.valid_from desc
     limit 1;
  end if;
  if v_before is null or not private.has_reminder_time(v_before) then
    insert into public.notification_category_prefs (user_id, category, enabled)
    select h.user_id, 'supplements', true from public.habits h where h.id = new.habit_id
    on conflict (user_id, category) do update set enabled = true;
  end if;
  return null;
end;
$$;
