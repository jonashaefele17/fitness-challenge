-- Web Push delivery.
--
-- Flow: pg_cron calls the edge function "send-push" every minute while undelivered
-- notifications exist. The function calls claim_push_deliveries(), which decides per person
-- what is due (category wanted, quiet hours, bundling), marks it as pushed and returns it
-- together with the person's devices. The function then sends the pushes.
--
-- Environment-specific values live in Vault (set per project, never in migrations):
--   push_function_url  https://<ref>.supabase.co/functions/v1/send-push
--   cron_secret        shared secret, also set as CRON_SECRET for the edge function

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- Devices
-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_success_at timestamptz,
  failure_count integer not null default 0
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- Delivery bookkeeping on notifications.
alter table public.notifications
  add column pushed_at timestamptz,
  add column push_skipped boolean not null default false;
create index notifications_push_pending_idx on public.notifications (recipient_id)
  where pushed_at is null;

-- Last push per person (for bundling). Internal: no API access at all.
create table public.push_state (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  last_push_at timestamptz not null
);

-- ---------------------------------------------------------------------------
-- Rules
-- ---------------------------------------------------------------------------
-- Quiet hours in the person's own time zone; the window may span midnight (22:00–07:00).
create function private.in_quiet_hours(p_user_id uuid, p_at timestamptz default now())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with prefs as (
    select coalesce(np.quiet_hours_enabled, true) as enabled,
           coalesce(np.quiet_start, '22:00'::time) as q_start,
           coalesce(np.quiet_end, '07:00'::time) as q_end,
           coalesce(np.time_zone, 'Europe/Berlin') as tz
      from (select 1) as one
      left join public.notification_prefs np on np.user_id = p_user_id
  ),
  local as (
    select p.*, (p_at at time zone p.tz)::time as t from prefs p
  )
  select enabled and case
           when q_start = q_end then false
           when q_start < q_end then t >= q_start and t < q_end
           else t >= q_start or t < q_end
         end
    from local;
$$;

create function private.wants_bundling(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select np.bundle from public.notification_prefs np where np.user_id = p_user_id),
    true
  );
$$;

-- Decides what is due now, marks it as pushed and returns one row per push to send.
-- Only the edge function (service role) may call this.
create function public.claim_push_deliveries(p_bundle_window interval default interval '5 minutes')
returns table (
  user_id uuid,
  notifications jsonb,
  unread bigint,
  subscriptions jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  r record;
  v_ids uuid[];
begin
  -- Never push: already read, older than a day, unwanted category, or no device.
  update public.notifications n
     set pushed_at = now(), push_skipped = true
   where n.pushed_at is null
     and (n.read_at is not null
       or n.created_at < now() - interval '1 day'
       or not private.wants_category(n.recipient_id, n.category)
       or not exists (select 1 from public.push_subscriptions s where s.user_id = n.recipient_id));

  for r in
    select n.recipient_id, count(*) as pending
      from public.notifications n
     where n.pushed_at is null
     group by n.recipient_id
  loop
    -- Quiet hours: keep pending, deliver when they end (the one-day limit still applies).
    continue when private.in_quiet_hours(r.recipient_id);

    if private.wants_bundling(r.recipient_id) then
      -- First push goes out at once; anything within the window waits and is then
      -- delivered as one summary.
      continue when exists (
        select 1 from public.push_state ps
         where ps.user_id = r.recipient_id and ps.last_push_at > now() - p_bundle_window
      );
      select array_agg(n.id order by n.created_at) into v_ids
        from public.notifications n
       where n.recipient_id = r.recipient_id and n.pushed_at is null;
    else
      select array_agg(n.id order by n.created_at) into v_ids
        from public.notifications n
       where n.recipient_id = r.recipient_id and n.pushed_at is null;
    end if;

    update public.notifications set pushed_at = now() where id = any (v_ids);

    insert into public.push_state (user_id, last_push_at) values (r.recipient_id, now())
    on conflict (user_id) do update set last_push_at = excluded.last_push_at;

    -- Bundled: one row with all notifications. Not bundled: one row per notification.
    return query
    with items as (
      select n.id, n.created_at,
             jsonb_build_object(
               'id', n.id,
               'event', n.event,
               'category', n.category,
               'actorName', p.display_name,
               'preview', n.data ->> 'preview',
               'target', jsonb_build_object(
                 'groupId', n.group_id,
                 'type', n.target_type,
                 'id', n.target_id,
                 'index', n.target_index
               ),
               'thread', n.comment_id is not null
             ) as item
        from public.notifications n
        left join public.profiles p on p.id = n.actor_id
       where n.id = any (v_ids)
    ),
    grouped as (
      select case when private.wants_bundling(r.recipient_id) then null else i.id end as bucket,
             jsonb_agg(i.item order by i.created_at) as notifications
        from items i
       group by 1
    )
    select r.recipient_id,
           g.notifications,
           (select count(*) from public.notifications u
             where u.recipient_id = r.recipient_id and u.read_at is null),
           (select coalesce(jsonb_agg(jsonb_build_object(
                     'id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)), '[]')
              from public.push_subscriptions s where s.user_id = r.recipient_id)
      from grouped g;
  end loop;
end;
$$;

-- Result reporting from the edge function.
create function public.report_push_result(p_subscription_id uuid, p_ok boolean, p_gone boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_gone then
    delete from public.push_subscriptions where id = p_subscription_id;
  elsif p_ok then
    update public.push_subscriptions
       set last_success_at = now(), failure_count = 0
     where id = p_subscription_id;
  else
    update public.push_subscriptions
       set failure_count = failure_count + 1
     where id = p_subscription_id;
    -- Give up on devices that keep failing.
    delete from public.push_subscriptions
     where id = p_subscription_id and failure_count >= 10;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Client RPCs: a device belongs to whoever registered it last (shared phones).
-- ---------------------------------------------------------------------------
create function public.register_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_endpoint !~ '^https://' then
    raise exception 'invalid_endpoint' using errcode = 'P0001';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        failure_count = 0;
end;
$$;

create function public.unregister_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_subscriptions
   where endpoint = p_endpoint and user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------
revoke all on public.push_subscriptions, public.push_state from anon, authenticated;
grant select on public.push_subscriptions to authenticated;

alter table public.push_subscriptions enable row level security;
alter table public.push_state enable row level security;

create policy "push_subscriptions: own devices" on public.push_subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on function public.claim_push_deliveries(interval) from public, anon, authenticated;
revoke all on function public.report_push_result(uuid, boolean, boolean) from public, anon, authenticated;
grant execute on function public.claim_push_deliveries(interval) to service_role;
grant execute on function public.report_push_result(uuid, boolean, boolean) to service_role;

revoke all on function public.register_push_subscription(text, text, text, text) from public, anon;
revoke all on function public.unregister_push_subscription(text) from public, anon;
grant execute on function public.register_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.unregister_push_subscription(text) to authenticated;

revoke all on all functions in schema private from public;

-- Existing notifications are history; only new ones are pushed.
update public.notifications set pushed_at = now(), push_skipped = true where pushed_at is null;

-- ---------------------------------------------------------------------------
-- Schedule: every minute, only when something is pending and the project is configured.
-- ---------------------------------------------------------------------------
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
    and exists (select 1 from public.notifications where pushed_at is null);
  $cron$
);
