-- Baustein 4a: day cards in the feed, workouts as feed events, more reactions.
--
-- Social layer (CLAUDE.md rules 13–14): the training module knows nothing of this. Finished
-- workouts reach the feed through a trigger here; the card content comes from the training
-- module's public RPC (workout_summaries).

-- ---------------------------------------------------------------------------
-- Local day of a person (their notification time zone, else Europe/Berlin)
-- ---------------------------------------------------------------------------
create function private.local_day(p_user_id uuid, p_at timestamptz)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (p_at at time zone coalesce(
    (select np.time_zone from public.notification_prefs np where np.user_id = p_user_id),
    'Europe/Berlin'))::date;
$$;

-- ---------------------------------------------------------------------------
-- Day cards: one per person, group and day. Comments and reactions on the card point at it.
-- ---------------------------------------------------------------------------
create table public.feed_days (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  -- Bumped by comments and reactions on the card or anything on it ("Zuletzt aktiv").
  last_activity_at timestamptz not null default now(),
  unique (group_id, actor_id, day)
);
create index feed_days_group_day_idx on public.feed_days (group_id, day desc);
create index feed_days_group_activity_idx on public.feed_days (group_id, last_activity_at desc);

alter table public.feed_days enable row level security;
revoke all on public.feed_days from anon, authenticated;
grant select on public.feed_days to authenticated;
create policy "feed_days: members read" on public.feed_days
  for select to authenticated using (private.is_group_member(group_id));

-- Every feed event belongs to the day card of its actor; occurred_at is when it happened
-- (a workout's start), created_at when it was posted.
alter table public.feed_events
  add column occurred_at timestamptz,
  add column feed_day_id uuid references public.feed_days (id) on delete cascade;

create function private.feed_events_assign_day()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.occurred_at := coalesce(new.occurred_at, new.created_at, now());
  insert into public.feed_days (group_id, actor_id, day)
  values (new.group_id, new.actor_id, private.local_day(new.actor_id, new.occurred_at))
  on conflict (group_id, actor_id, day) do update set day = excluded.day
  returning id into new.feed_day_id;
  return new;
end;
$$;

create trigger feed_events_assign_day
  before insert on public.feed_events
  for each row execute function private.feed_events_assign_day();

-- Existing events (member_joined) get their day card.
update public.feed_events set occurred_at = created_at;
insert into public.feed_days (group_id, actor_id, day, created_at, last_activity_at)
select fe.group_id, fe.actor_id, private.local_day(fe.actor_id, fe.created_at),
       min(fe.created_at), max(fe.last_activity_at)
  from public.feed_events fe
 group by fe.group_id, fe.actor_id, private.local_day(fe.actor_id, fe.created_at)
on conflict do nothing;
update public.feed_events fe
   set feed_day_id = fd.id
  from public.feed_days fd
 where fd.group_id = fe.group_id and fd.actor_id = fe.actor_id
   and fd.day = private.local_day(fe.actor_id, fe.created_at);
alter table public.feed_events
  alter column occurred_at set not null,
  alter column feed_day_id set not null;
create index feed_events_day_idx on public.feed_events (feed_day_id, occurred_at);

-- Day cards are commentable and reactable.
create function private.feed_day_visible(p_target_id uuid, p_group_id uuid, p_viewer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.feed_days fd where fd.id = p_target_id and fd.group_id = p_group_id
  ) and private.is_member(p_group_id, p_viewer_id);
$$;

create function private.feed_day_owner(p_target_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select fd.actor_id from public.feed_days fd where fd.id = p_target_id;
$$;

insert into public.target_types (key, module, can_view_fn, owner_fn) values
  ('feed_day', 'feed', 'private.feed_day_visible', 'private.feed_day_owner');

-- Activity on a card, on one of its events or on an event's object bumps the card too.
create or replace function private.bump_feed_activity(p_group_id uuid, p_target_type text, p_target_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.feed_events fe
     set last_activity_at = now()
   where fe.group_id = p_group_id
     and ((p_target_type = 'feed_event' and fe.id = p_target_id)
       or (fe.target_type = p_target_type and fe.target_id = p_target_id));
  update public.feed_days fd
     set last_activity_at = now()
   where fd.group_id = p_group_id
     and ((p_target_type = 'feed_day' and fd.id = p_target_id)
       or fd.id in (
         select fe.feed_day_id from public.feed_events fe
          where fe.group_id = p_group_id
            and ((p_target_type = 'feed_event' and fe.id = p_target_id)
              or (fe.target_type = p_target_type and fe.target_id = p_target_id))));
$$;

-- ---------------------------------------------------------------------------
-- Workouts in the feed
-- ---------------------------------------------------------------------------
create function private.workout_visible(p_target_id uuid, p_group_id uuid, p_viewer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workouts w
     where w.id = p_target_id and w.status = 'finished'
       and private.is_member(p_group_id, w.user_id)
  ) and private.is_member(p_group_id, p_viewer_id);
$$;

-- Owner: private.workout_owner (training module).

insert into public.target_types (key, module, can_view_fn, owner_fn) values
  ('workout', 'training', 'private.workout_visible', 'private.workout_owner');

insert into public.feed_event_types (key, description) values
  ('workout_finished', 'A person finished (or logged) a workout');

-- A finished workout lands on the person's day card in each of their groups. Logged more
-- than three hours after it ended, it counts as added later ("nachgetragen"): it shows on
-- its day without notifying anyone.
create function private.on_workout_finished()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_late boolean := new.ended_at < now() - interval '3 hours';
  v_group record;
  v_event_id uuid;
  v_day_id uuid;
  v_preview text;
begin
  if new.status <> 'finished' or (tg_op = 'UPDATE' and old.status = 'finished') then
    return new;
  end if;
  -- "Studio · Push" / "Laufen · Outdoor" as the line under the push title.
  select concat_ws(' · ', t.name, f.name, new.variant) into v_preview
    from public.training_types t
    left join public.training_focuses f on f.id = new.focus_id
   where t.id = new.training_type_id;
  for v_group in
    select gm.group_id from public.group_members gm where gm.user_id = new.user_id
  loop
    insert into public.feed_events
      (group_id, actor_id, type, target_type, target_id, occurred_at, data)
    values
      (v_group.group_id, new.user_id, 'workout_finished', 'workout', new.id, new.started_at,
       jsonb_build_object('late', v_late))
    returning id, feed_day_id into v_event_id, v_day_id;

    if not v_late then
      insert into public.notifications
        (recipient_id, group_id, category, event, actor_id, target_type, target_id, data)
      select gm.user_id, v_group.group_id, 'all_activity', 'workout_finished', new.user_id,
             'feed_day', v_day_id, jsonb_build_object('preview', v_preview)
        from public.group_members gm
       where gm.group_id = v_group.group_id
         and gm.user_id <> new.user_id
         and private.wants_category(gm.user_id, 'all_activity');
    end if;
  end loop;
  return new;
end;
$$;

create trigger workouts_after_finish
  after insert or update of status on public.workouts
  for each row execute function private.on_workout_finished();

-- A deleted workout leaves the feed; an empty day card goes with it.
create function private.on_workout_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.feed_events fe where fe.target_type = 'workout' and fe.target_id = old.id;
  delete from public.feed_days fd
   where not exists (select 1 from public.feed_events fe where fe.feed_day_id = fd.id)
     and fd.actor_id = old.user_id;
  return old;
end;
$$;

create trigger workouts_after_delete
  after delete on public.workouts
  for each row execute function private.on_workout_deleted();

-- ---------------------------------------------------------------------------
-- The feed: day cards with their events, newest day first or most recently active first.
-- Keyset paging: pass the last card's (day, latest_at, id) resp. (last_activity_at, id).
-- ---------------------------------------------------------------------------
create function public.feed_cards(
  p_group_id uuid,
  p_sort text default 'newest',
  p_limit integer default 15,
  p_before_day date default null,
  p_before_at timestamptz default null,
  p_before_id uuid default null
)
returns table (
  id uuid,
  actor_id uuid,
  day date,
  latest_at timestamptz,
  last_activity_at timestamptz,
  events jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  with cards as (
    select fd.id, fd.actor_id, fd.day, fd.last_activity_at,
           max(fe.occurred_at) as latest_at,
           jsonb_agg(jsonb_build_object(
             'id', fe.id, 'type', fe.type, 'targetType', fe.target_type,
             'targetId', fe.target_id, 'data', fe.data, 'occurredAt', fe.occurred_at,
             'createdAt', fe.created_at) order by fe.occurred_at) as events
      from public.feed_days fd
      join public.feed_events fe on fe.feed_day_id = fd.id
     where fd.group_id = p_group_id
     group by fd.id
  )
  select c.id, c.actor_id, c.day, c.latest_at, c.last_activity_at, c.events
    from cards c
   where case
           when p_before_id is null then true
           when p_sort = 'active' then (c.last_activity_at, c.id) < (p_before_at, p_before_id)
           else (c.day, c.latest_at, c.id) < (p_before_day, p_before_at, p_before_id)
         end
   order by
     case when p_sort = 'active' then c.last_activity_at end desc nulls last,
     case when p_sort = 'active' then null else c.day end desc nulls last,
     case when p_sort = 'active' then null else c.latest_at end desc nulls last,
     c.id desc
   limit least(greatest(p_limit, 1), 50);
$$;

revoke all on function public.feed_cards(uuid, text, integer, date, timestamptz, uuid) from public, anon;
grant execute on function public.feed_cards(uuid, text, integer, date, timestamptz, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Reactions: a small set like iMessage, one per person and object
-- ---------------------------------------------------------------------------
insert into public.reaction_kinds (key, emoji, sort) values
  ('strong', '💪', 1), ('clap', '👏', 2), ('laugh', '😂', 3), ('wow', '😮', 4), ('heart', '❤️', 5);

drop index public.reactions_unique_idx;
create unique index reactions_unique_idx on public.reactions
  (group_id, target_type, target_id, coalesce(target_index, -1), user_id);

-- Set, change or remove (null) my reaction on an object.
create function public.set_reaction(
  p_group_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_target_index integer,
  p_kind text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_kind is null then
    delete from public.reactions r
     where r.group_id = p_group_id and r.target_type = p_target_type
       and r.target_id = p_target_id
       and r.target_index is not distinct from p_target_index
       and r.user_id = (select auth.uid());
    return;
  end if;
  -- Changing the kind keeps the row (no second notification).
  update public.reactions r set kind = p_kind
   where r.group_id = p_group_id and r.target_type = p_target_type
     and r.target_id = p_target_id
     and r.target_index is not distinct from p_target_index
     and r.user_id = (select auth.uid());
  if not found then
    insert into public.reactions (group_id, target_type, target_id, target_index, kind)
    values (p_group_id, p_target_type, p_target_id, p_target_index, p_kind);
  end if;
end;
$$;

revoke all on function public.set_reaction(uuid, text, uuid, integer, text) from public, anon;
grant execute on function public.set_reaction(uuid, text, uuid, integer, text) to authenticated;
grant update (kind) on public.reactions to authenticated;
create policy "reactions: change your own" on public.reactions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- The bell names the emoji.
create or replace function private.on_reaction_inserted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := private.target_owner(new.target_type, new.target_id);
begin
  perform private.bump_feed_activity(new.group_id, new.target_type, new.target_id);

  if v_owner is null or v_owner = new.user_id then
    return new;
  end if;
  -- One notification per person, object and day, even if the reaction is toggled.
  if exists (
    select 1 from public.notifications n
     where n.recipient_id = v_owner
       and n.actor_id = new.user_id
       and n.event = 'reaction'
       and n.target_type = new.target_type
       and n.target_id = new.target_id
       and n.target_index is not distinct from new.target_index
       and n.created_at > now() - interval '1 day'
  ) then
    return new;
  end if;

  insert into public.notifications
    (recipient_id, group_id, category, event, actor_id, target_type, target_id, target_index, data)
  values
    (v_owner, new.group_id, 'reactions', 'reaction', new.user_id,
     new.target_type, new.target_id, new.target_index,
     jsonb_build_object('kind', new.kind,
       'emoji', (select rk.emoji from public.reaction_kinds rk where rk.key = new.kind)));
  return new;
end;
$$;

-- Pushes carry the reaction's emoji (same function as before, the item gains "emoji").
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
               'emoji', n.data ->> 'emoji',
               'target', jsonb_build_object(
                 'groupId', n.group_id,
                 'type', n.target_type,
                 'id', n.target_id,
                 'index', n.target_index
               ),
               'thread', n.comment_id is not null,
               'commentId', n.comment_id
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
