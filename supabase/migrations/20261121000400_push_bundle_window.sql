-- Bundling window 3 instead of 5 minutes (decision 21.11.2026). Same function, new default.
create or replace function public.claim_push_deliveries(p_bundle_window interval default interval '3 minutes')
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
  -- One claim at a time: the instant trigger and the minute schedule may overlap, and
  -- both must not pick up the same notifications (no duplicate pushes).
  perform pg_advisory_xact_lock(hashtext('public.claim_push_deliveries'));

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

revoke all on function public.claim_push_deliveries(interval) from public, anon, authenticated;
grant execute on function public.claim_push_deliveries(interval) to service_role;
