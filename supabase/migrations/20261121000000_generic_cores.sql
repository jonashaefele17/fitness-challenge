-- Generic social cores: object references, feed events, comments, reactions, read markers
-- and the notification engine (rows only; push delivery follows in a later migration).
--
-- All of this is the social layer (CLAUDE.md rules 13–14). Personal modules never reference
-- these tables; they are made commentable by registering a target type in a social/glue
-- migration that points at their visibility and owner functions.

-- ---------------------------------------------------------------------------
-- Membership helper for an arbitrary user (the core helpers use auth.uid()).
-- ---------------------------------------------------------------------------
create function private.is_member(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id and gm.user_id = p_user_id
  );
$$;

-- ---------------------------------------------------------------------------
-- Object references: which kinds of objects can be commented on / reacted to.
-- ---------------------------------------------------------------------------
create table public.target_types (
  key text primary key check (key ~ '^[a-z][a-z_]*$'),
  module text not null,
  -- (target_id uuid, group_id uuid, viewer_id uuid) -> boolean
  -- "may viewer see this object within this group?"
  can_view_fn regproc not null,
  -- (target_id uuid) -> uuid: the person who owns the object (gets "comments on mine").
  owner_fn regproc not null
);
comment on table public.target_types is
  'Registry of commentable object types (target_type). Maintained by migrations only.';

-- True if viewer may see the target in the context of the group. The viewer must be a
-- member of the group; the object type decides the rest.
create function private.can_view_target(
  p_target_type text,
  p_target_id uuid,
  p_group_id uuid,
  p_viewer_id uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_fn regproc;
  v_result boolean;
begin
  if p_viewer_id is null or not private.is_member(p_group_id, p_viewer_id) then
    return false;
  end if;
  select can_view_fn into v_fn from public.target_types where key = p_target_type;
  if v_fn is null then
    return false;
  end if;
  execute format('select %s($1, $2, $3)', v_fn) into v_result
    using p_target_id, p_group_id, p_viewer_id;
  return coalesce(v_result, false);
end;
$$;

create function private.target_owner(p_target_type text, p_target_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_fn regproc;
  v_owner uuid;
begin
  select owner_fn into v_fn from public.target_types where key = p_target_type;
  if v_fn is null then
    return null;
  end if;
  execute format('select %s($1)', v_fn) into v_owner using p_target_id;
  return v_owner;
end;
$$;

-- ---------------------------------------------------------------------------
-- Feed events
-- ---------------------------------------------------------------------------
create table public.feed_event_types (
  key text primary key check (key ~ '^[a-z][a-z_]*$'),
  description text not null
);

insert into public.feed_event_types (key, description) values
  ('member_joined', 'A person joined the group');

create table public.feed_events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  type text not null references public.feed_event_types (key),
  -- Optional object the event is about (e.g. a workout); null for member_joined.
  target_type text references public.target_types (key),
  target_id uuid,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  -- Bumped by comments and reactions; used for the "recently active" sort.
  last_activity_at timestamptz not null default now(),
  constraint feed_events_target_pair check ((target_type is null) = (target_id is null))
);
create index feed_events_group_created_idx on public.feed_events (group_id, created_at desc);
create index feed_events_group_activity_idx on public.feed_events (group_id, last_activity_at desc);
create index feed_events_target_idx on public.feed_events (target_type, target_id);

create function private.feed_event_visible(p_target_id uuid, p_group_id uuid, p_viewer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.feed_events fe
    where fe.id = p_target_id and fe.group_id = p_group_id
  ) and private.is_member(p_group_id, p_viewer_id);
$$;

create function private.feed_event_owner(p_target_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select fe.actor_id from public.feed_events fe where fe.id = p_target_id;
$$;

insert into public.target_types (key, module, can_view_fn, owner_fn) values
  ('feed_event', 'feed', 'private.feed_event_visible', 'private.feed_event_owner');

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  target_type text not null references public.target_types (key),
  target_id uuid not null,
  -- Optional position inside the target (e.g. set number within an exercise).
  target_index integer check (target_index is null or target_index >= 0),
  -- Replies are one level deep: parent_id always points at a root comment.
  parent_id uuid references public.comments (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
create index comments_target_idx
  on public.comments (group_id, target_type, target_id, created_at);
create index comments_parent_idx on public.comments (parent_id);

create table public.comment_mentions (
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (comment_id, user_id)
);
create index comment_mentions_user_idx on public.comment_mentions (user_id);

-- Editing keeps an edited_at stamp; deleting is soft (body stays for the author's undo).
create function private.comments_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.body is distinct from old.body then
    new.edited_at := now();
  end if;
  return new;
end;
$$;

create trigger comments_before_update
  before update on public.comments
  for each row execute function private.comments_before_update();

-- ---------------------------------------------------------------------------
-- Reactions
-- ---------------------------------------------------------------------------
create table public.reaction_kinds (
  key text primary key check (key ~ '^[a-z][a-z_]*$'),
  emoji text not null,
  sort integer not null default 0
);

insert into public.reaction_kinds (key, emoji, sort) values ('fire', '🔥', 0);

create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  target_type text not null references public.target_types (key),
  target_id uuid not null,
  target_index integer check (target_index is null or target_index >= 0),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null default 'fire' references public.reaction_kinds (key),
  created_at timestamptz not null default now()
);
create unique index reactions_unique_idx on public.reactions
  (group_id, target_type, target_id, coalesce(target_index, -1), user_id, kind);

-- ---------------------------------------------------------------------------
-- Read markers ("4 · 2 new")
-- ---------------------------------------------------------------------------
create table public.read_markers (
  user_id uuid not null references public.profiles (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  target_type text not null references public.target_types (key),
  target_id uuid not null,
  target_index integer,
  last_read_at timestamptz not null default now()
);
create unique index read_markers_unique_idx on public.read_markers
  (user_id, group_id, target_type, target_id, coalesce(target_index, -1));

-- ---------------------------------------------------------------------------
-- Notification settings (categories and presets are data)
-- ---------------------------------------------------------------------------
create table public.notification_categories (
  key text primary key check (key ~ '^[a-z][a-z_]*$'),
  label text not null,
  description text not null,
  sort integer not null,
  -- Included in which preset ("Nur Wichtiges" / "Standard" / "Alles").
  in_important boolean not null,
  in_standard boolean not null,
  in_all boolean not null default true
);

insert into public.notification_categories
  (key, label, description, sort, in_important, in_standard) values
  ('comments_on_mine', 'Kommentare auf meine Einträge', 'Jemand kommentiert etwas von dir.', 10, true, true),
  ('replies', 'Antworten', 'Neue Antworten in Unterhaltungen, an denen du beteiligt bist.', 20, true, true),
  ('mentions', 'Erwähnungen', 'Jemand erwähnt dich mit @.', 30, true, true),
  ('reactions', 'Reaktionen', 'Jemand reagiert auf etwas von dir.', 40, false, true),
  ('all_activity', 'Alle Aktivitäten', 'Jeder neue Kommentar und Beitrag in der Gruppe.', 50, false, false),
  ('appointments', 'Termine', 'Einladungen, Zusagen und Änderungen an Terminen.', 60, true, true),
  ('checkin_reminder', 'Check-in-Erinnerung', 'Erinnerung an deinen täglichen Check-in.', 70, false, true),
  ('supplements', 'Supplements', 'Erinnerungen an deine Supplements.', 80, false, true);

create table public.notification_prefs (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  preset text not null default 'standard' check (preset in ('important', 'standard', 'all')),
  bundle boolean not null default true,
  quiet_hours_enabled boolean not null default true,
  quiet_start time not null default '22:00',
  quiet_end time not null default '07:00',
  time_zone text not null default 'Europe/Berlin',
  updated_at timestamptz not null default now()
);

create trigger notification_prefs_set_updated_at
  before update on public.notification_prefs
  for each row execute function private.set_updated_at();

create table public.notification_category_prefs (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  category text not null references public.notification_categories (key),
  enabled boolean not null,
  primary key (user_id, category)
);

-- Whether a user wants a category: explicit override, otherwise the preset.
create function private.wants_category(p_user_id uuid, p_category text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select cp.enabled from public.notification_category_prefs cp
      where cp.user_id = p_user_id and cp.category = p_category),
    (select case coalesce(np.preset, 'standard')
              when 'important' then nc.in_important
              when 'all' then nc.in_all
              else nc.in_standard
            end
       from public.notification_categories nc
       left join public.notification_prefs np on np.user_id = p_user_id
      where nc.key = p_category),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- Notifications (the bell). Push delivery is added later and only reads these rows.
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  category text not null references public.notification_categories (key),
  -- What happened: comment | reply | mention | reaction | member_joined
  event text not null,
  actor_id uuid references public.profiles (id) on delete set null,
  target_type text not null references public.target_types (key),
  target_id uuid not null,
  target_index integer,
  comment_id uuid references public.comments (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
create index notifications_unread_idx on public.notifications (recipient_id) where read_at is null;

-- ---------------------------------------------------------------------------
-- Engine: who gets notified (server-side, so every client triggers the same rules)
-- ---------------------------------------------------------------------------
create function private.bump_feed_activity(p_group_id uuid, p_target_type text, p_target_id uuid)
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
$$;

create function private.notify_comment(p_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.comments%rowtype;
  v_owner uuid;
  v_preview text;
begin
  select * into c from public.comments where id = p_comment_id;
  v_owner := private.target_owner(c.target_type, c.target_id);
  v_preview := left(regexp_replace(btrim(c.body), '\s+', ' ', 'g'), 140);

  -- Direct recipients, highest priority first: mention > reply > owner.
  with candidates (user_id, category, event, prio) as (
    select m.user_id, 'mentions', 'mention', 1
      from public.comment_mentions m where m.comment_id = c.id
    union all
    select p.author_id, 'replies', 'reply', 2
      from public.comments p where p.id = c.parent_id
    union all
    select t.author_id, 'replies', 'reply', 2
      from public.comments t
     where t.group_id = c.group_id
       and t.target_type = c.target_type
       and t.target_id = c.target_id
       and t.target_index is not distinct from c.target_index
       and t.id <> c.id
       and t.deleted_at is null
    union all
    select v_owner, 'comments_on_mine', 'comment', 3
  ),
  direct as (
    select distinct on (cand.user_id) cand.user_id, cand.category, cand.event
      from candidates cand
     where cand.user_id is not null
       and cand.user_id <> c.author_id
       and private.can_view_target(c.target_type, c.target_id, c.group_id, cand.user_id)
     order by cand.user_id, cand.prio
  ),
  activity as (
    select gm.user_id, 'all_activity'::text as category, 'comment'::text as event
      from public.group_members gm
     where gm.group_id = c.group_id
       and gm.user_id <> c.author_id
       and gm.user_id not in (select d.user_id from direct d)
       and private.wants_category(gm.user_id, 'all_activity')
       and private.can_view_target(c.target_type, c.target_id, c.group_id, gm.user_id)
  )
  insert into public.notifications
    (recipient_id, group_id, category, event, actor_id,
     target_type, target_id, target_index, comment_id, data)
  select r.user_id, c.group_id, r.category, r.event, c.author_id,
         c.target_type, c.target_id, c.target_index, c.id,
         jsonb_build_object('preview', v_preview)
    from (select * from direct union all select * from activity) r;

  perform private.bump_feed_activity(c.group_id, c.target_type, c.target_id);
end;
$$;

create function private.on_reaction_inserted()
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
     new.target_type, new.target_id, new.target_index, jsonb_build_object('kind', new.kind));
  return new;
end;
$$;

create trigger reactions_after_insert
  after insert on public.reactions
  for each row execute function private.on_reaction_inserted();

-- Joining a group creates a feed event; people who want all activity get notified.
create function private.on_member_joined()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
begin
  insert into public.feed_events (group_id, actor_id, type)
  values (new.group_id, new.user_id, 'member_joined')
  returning id into v_event_id;

  insert into public.notifications
    (recipient_id, group_id, category, event, actor_id, target_type, target_id)
  select gm.user_id, new.group_id, 'all_activity', 'member_joined', new.user_id,
         'feed_event', v_event_id
    from public.group_members gm
   where gm.group_id = new.group_id
     and gm.user_id <> new.user_id
     and private.wants_category(gm.user_id, 'all_activity');
  return new;
end;
$$;

create trigger group_members_after_insert
  after insert on public.group_members
  for each row execute function private.on_member_joined();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
-- Errors (message): not_authenticated, target_not_found, invalid_parent
create function public.post_comment(
  p_group_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_body text,
  p_target_index integer default null,
  p_parent_id uuid default null,
  p_mentions uuid[] default '{}'
)
returns public.comments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_parent public.comments%rowtype;
  v_parent_id uuid := p_parent_id;
  v_comment public.comments%rowtype;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.can_view_target(p_target_type, p_target_id, p_group_id, v_user_id) then
    raise exception 'target_not_found' using errcode = 'P0001';
  end if;

  if v_parent_id is not null then
    select * into v_parent from public.comments where id = v_parent_id;
    if not found
      or v_parent.group_id <> p_group_id
      or v_parent.target_type <> p_target_type
      or v_parent.target_id <> p_target_id
      or v_parent.target_index is distinct from p_target_index then
      raise exception 'invalid_parent' using errcode = 'P0001';
    end if;
    -- Keep threads one level deep.
    v_parent_id := coalesce(v_parent.parent_id, v_parent.id);
  end if;

  insert into public.comments
    (group_id, target_type, target_id, target_index, parent_id, author_id, body)
  values
    (p_group_id, p_target_type, p_target_id, p_target_index, v_parent_id, v_user_id, btrim(p_body))
  returning * into v_comment;

  -- Only group members can be mentioned; mentioning yourself is ignored.
  insert into public.comment_mentions (comment_id, user_id)
  select distinct v_comment.id, m
    from unnest(coalesce(p_mentions, '{}')) as m
   where m <> v_user_id and private.is_member(p_group_id, m);

  perform private.notify_comment(v_comment.id);

  -- Writing in a thread means you have read it.
  perform public.mark_thread_read(p_group_id, p_target_type, p_target_id, p_target_index);

  return v_comment;
end;
$$;

create function public.mark_thread_read(
  p_group_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_target_index integer default null
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
  if not private.can_view_target(p_target_type, p_target_id, p_group_id) then
    raise exception 'target_not_found' using errcode = 'P0001';
  end if;

  insert into public.read_markers (user_id, group_id, target_type, target_id, target_index, last_read_at)
  values (auth.uid(), p_group_id, p_target_type, p_target_id, p_target_index, now())
  on conflict (user_id, group_id, target_type, target_id, (coalesce(target_index, -1)))
  do update set last_read_at = excluded.last_read_at;

  -- Reading a thread also clears its notifications.
  update public.notifications n
     set read_at = now()
   where n.recipient_id = auth.uid()
     and n.read_at is null
     and n.group_id = p_group_id
     and n.target_type = p_target_type
     and n.target_id = p_target_id
     and n.target_index is not distinct from p_target_index
     and n.comment_id is not null;
end;
$$;

-- Comment counts per object for the speech bubbles: total and unread (by others, after the
-- reader's marker), plus the latest comment for the preview line.
create function public.comment_stats(
  p_group_id uuid,
  p_target_type text,
  p_target_ids uuid[]
)
returns table (
  target_id uuid,
  target_index integer,
  total bigint,
  unread bigint,
  last_comment_id uuid,
  last_author_id uuid,
  last_body text,
  last_created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with visible as (
    select c.*
      from public.comments c
     where c.group_id = p_group_id
       and c.target_type = p_target_type
       and c.target_id = any (p_target_ids)
       and c.deleted_at is null
  ),
  markers as (
    select rm.target_id, rm.target_index, rm.last_read_at
      from public.read_markers rm
     where rm.user_id = (select auth.uid())
       and rm.group_id = p_group_id
       and rm.target_type = p_target_type
       and rm.target_id = any (p_target_ids)
  ),
  last_comment as (
    select distinct on (v.target_id, v.target_index)
           v.target_id, v.target_index, v.id, v.author_id, v.body, v.created_at
      from visible v
     order by v.target_id, v.target_index, v.created_at desc
  )
  select v.target_id,
         v.target_index,
         count(*) as total,
         count(*) filter (
           where v.author_id <> (select auth.uid())
             and v.created_at > coalesce(m.last_read_at, '-infinity'::timestamptz)
         ) as unread,
         lc.id, lc.author_id, left(lc.body, 140), lc.created_at
    from visible v
    left join markers m
      on m.target_id = v.target_id and m.target_index is not distinct from v.target_index
    join last_comment lc
      on lc.target_id = v.target_id and lc.target_index is not distinct from v.target_index
   group by v.target_id, v.target_index, lc.id, lc.author_id, lc.body, lc.created_at;
$$;

create function public.mark_all_notifications_read()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notifications
     set read_at = now()
   where recipient_id = auth.uid() and read_at is null;
$$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
revoke all on
  public.target_types, public.feed_event_types, public.feed_events, public.comments,
  public.comment_mentions, public.reaction_kinds, public.reactions, public.read_markers,
  public.notification_categories, public.notification_prefs,
  public.notification_category_prefs, public.notifications
  from anon, authenticated;

-- Reference data (readable, never writable through the API).
grant select on public.target_types, public.feed_event_types, public.reaction_kinds,
  public.notification_categories to authenticated;

grant select on public.feed_events to authenticated;
grant select on public.comments to authenticated;
grant update (body, deleted_at) on public.comments to authenticated;
grant select on public.comment_mentions to authenticated;
grant select, insert, delete on public.reactions to authenticated;
grant select on public.read_markers to authenticated;
grant select, insert, update, delete on public.notification_prefs to authenticated;
grant select, insert, update, delete on public.notification_category_prefs to authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

revoke all on function public.post_comment(uuid, text, uuid, text, integer, uuid, uuid[]) from public, anon;
revoke all on function public.mark_thread_read(uuid, text, uuid, integer) from public, anon;
revoke all on function public.comment_stats(uuid, text, uuid[]) from public, anon;
revoke all on function public.mark_all_notifications_read() from public, anon;
grant execute on function public.post_comment(uuid, text, uuid, text, integer, uuid, uuid[]) to authenticated;
grant execute on function public.mark_thread_read(uuid, text, uuid, integer) to authenticated;
grant execute on function public.comment_stats(uuid, text, uuid[]) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;

revoke all on all functions in schema private from public;
grant execute on function private.is_member(uuid, uuid) to authenticated;
grant execute on function private.can_view_target(text, uuid, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.target_types enable row level security;
alter table public.feed_event_types enable row level security;
alter table public.feed_events enable row level security;
alter table public.comments enable row level security;
alter table public.comment_mentions enable row level security;
alter table public.reaction_kinds enable row level security;
alter table public.reactions enable row level security;
alter table public.read_markers enable row level security;
alter table public.notification_categories enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.notification_category_prefs enable row level security;
alter table public.notifications enable row level security;

create policy "target_types: readable" on public.target_types
  for select to authenticated using (true);
create policy "feed_event_types: readable" on public.feed_event_types
  for select to authenticated using (true);
create policy "reaction_kinds: readable" on public.reaction_kinds
  for select to authenticated using (true);
create policy "notification_categories: readable" on public.notification_categories
  for select to authenticated using (true);

create policy "feed_events: members read" on public.feed_events
  for select to authenticated
  using (private.is_group_member(group_id));

create policy "comments: readers of the target" on public.comments
  for select to authenticated
  using (private.can_view_target(target_type, target_id, group_id));

-- Authors edit or soft-delete their own comments.
create policy "comments: authors update" on public.comments
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy "comment_mentions: readers of the comment" on public.comment_mentions
  for select to authenticated
  using (exists (select 1 from public.comments c where c.id = comment_id));

create policy "reactions: readers of the target" on public.reactions
  for select to authenticated
  using (private.can_view_target(target_type, target_id, group_id));

create policy "reactions: react as yourself" on public.reactions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and private.can_view_target(target_type, target_id, group_id)
  );

create policy "reactions: remove your own" on public.reactions
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "read_markers: own" on public.read_markers
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "notification_prefs: own" on public.notification_prefs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "notification_category_prefs: own" on public.notification_category_prefs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "notifications: own" on public.notifications
  for select to authenticated
  using (recipient_id = (select auth.uid()));

create policy "notifications: mark own as read" on public.notifications
  for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Backfill: feed events for memberships that existed before this migration.
-- ---------------------------------------------------------------------------
insert into public.feed_events (group_id, actor_id, type, created_at, last_activity_at)
select gm.group_id, gm.user_id, 'member_joined', gm.joined_at, gm.joined_at
  from public.group_members gm;
