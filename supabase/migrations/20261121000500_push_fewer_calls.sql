-- Fewer edge function calls:
-- 1. The instant trigger only fires when notification rows were actually inserted
--    (a statement-level trigger also fires for inserts of zero rows).
-- 2. The minute schedule skips notifications that are only waiting for quiet hours to end.

drop trigger notifications_kick_push on public.notifications;

create or replace function private.kick_push_delivery()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from new_rows) then
    return null;
  end if;
  perform net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'push_function_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'push_function_url');
  return null;
end;
$$;

create trigger notifications_kick_push
  after insert on public.notifications
  referencing new table as new_rows
  for each statement execute function private.kick_push_delivery();

-- Pending work the schedule should act on: not yet pushed and not held by quiet hours.
create function private.push_work_pending()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.notifications n
     where n.pushed_at is null
       and not private.in_quiet_hours(n.recipient_id)
  );
$$;

select cron.unschedule('send-push');
select cron.schedule(
  'send-push',
  '* * * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'push_function_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'push_function_url')
    and private.push_work_pending();
  $cron$
);

revoke all on all functions in schema private from public;
