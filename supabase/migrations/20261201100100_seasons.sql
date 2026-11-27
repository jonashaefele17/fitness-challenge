-- Baustein 8b (seasons, social): a season is a frame of a group – name, period, setup
-- phase, participants, rules and the goals fixed for that period. Trainings, weight and
-- habits are never reset; a season goal is an ordinary personal goal (goals table) linked to
-- the season here, in the social layer (the goals migrations stay free of social references).
--
--   seasons:         the frame (group_id); rules as data: weigh_weekly, checkin_every_weeks,
--                    required_metrics (goal metric keys; default only trainings_per_week).
--                    Cancelled instead of deleted.
--   season_members:  the participants. starts_on: the season's start, or a late entrant's own
--                    start (late_entry). ready_at: marked "Bereit".
--   season_goals:    which goals of a participant belong to the season (a goal to at most
--                    one season).
-- Computed, never stored: the phase (announced · setup · running · ended · cancelled), week
-- x of y, days left, who is locked, which required metrics are missing, calendar markers.
--
-- Rules:
--   * Only a group admin creates, changes and cancels a season and its participants.
--   * Setup: from setup_opens_on until the start every participant links goals (period =
--     own start → season end, visibility shared) and may mark themselves ready, which needs
--     a goal for every required metric. Everything stays changeable until the start.
--   * Lock: from the season's start day (in the season's time zone) a participant's season
--     goals are locked; a late entrant's when they mark themselves ready. Locked goals: the
--     owner can no longer change, archive or discard them; only a group admin corrects their
--     values (correct_season_goal), and every correction posts a feed event. Implemented by
--     replacing private.can_edit_goal, the goals module's one place for this.
--   * Late entry: a participant added on or after the start day gets their own start date
--     and their own setup until they mark themselves ready. An admin can also turn a
--     participant who missed the setup into a late entrant (add_season_participant again).
--   * Cancelling unlinks all goals (they stay as ordinary goals) and unlocks them.
-- Events: feed cards season_announced (on creation), season_started (start day from 7:00,
-- once), season_goal_corrected; pushes in category "seasons": setup open, the day before
-- the start (to those not ready), the start, a correction to the goal's owner. Goals and
-- seasons are registered as target types (commentable, push jump targets).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  -- From this day participants set their goals (default: the day it is created).
  setup_opens_on date not null,
  starts_on date not null,
  ends_on date not null,
  -- Rules (stored only; the participants' own body rhythms follow them through the setup).
  weigh_weekly boolean not null default false,
  -- null: no Zwischenstand rule.
  checkin_every_weeks smallint check (checkin_every_weeks between 1 and 12),
  -- Goal metrics every participant needs before "Bereit".
  required_metrics text[] not null default '{trainings_per_week}',
  -- Which local day it is for the season (start, lock, jobs): the creator's time zone.
  time_zone text not null default 'Europe/Berlin',
  created_by uuid references public.profiles (id) on delete set null,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on > starts_on),
  check (setup_opens_on <= starts_on)
);
create index seasons_group_idx on public.seasons (group_id, starts_on);

create trigger seasons_set_updated_at
  before update on public.seasons
  for each row execute function private.set_updated_at();

create table public.season_members (
  season_id uuid not null references public.seasons (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- The start of this participant's season goals (the season's, or a late entrant's own).
  starts_on date not null,
  -- Joined on or after the start: own setup until ready.
  late_entry boolean not null default false,
  ready_at timestamptz,
  added_at timestamptz not null default now(),
  primary key (season_id, user_id)
);
create index season_members_user_idx on public.season_members (user_id);

create table public.season_goals (
  season_id uuid not null,
  user_id uuid not null,
  goal_id uuid not null unique references public.goals (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (season_id, goal_id),
  foreign key (season_id, user_id)
    references public.season_members (season_id, user_id) on delete cascade
);
create index season_goals_member_idx on public.season_goals (season_id, user_id);

-- What was pushed (once per season, person and event).
create table public.season_notification_log (
  season_id uuid not null references public.seasons (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  event text not null,
  sent_at timestamptz not null default now(),
  primary key (season_id, user_id, event)
);

alter table public.seasons enable row level security;
alter table public.season_members enable row level security;
alter table public.season_goals enable row level security;
alter table public.season_notification_log enable row level security;
revoke all on public.seasons, public.season_members, public.season_goals,
  public.season_notification_log from anon, authenticated;
-- Reading only; writing through the functions below.
grant select on public.seasons, public.season_members, public.season_goals to authenticated;

-- Seasons and participants: the group's members (and the super admin, as for groups and
-- their members). Links of goals: members only.
create policy "seasons: members read" on public.seasons
  for select to authenticated
  using (private.is_group_member(group_id) or private.is_super_admin());
create policy "season_members: readers of the season" on public.season_members
  for select to authenticated
  using (exists (select 1 from public.seasons s where s.id = season_id));
create policy "season_goals: members of the season's group" on public.season_goals
  for select to authenticated
  using (exists (select 1 from public.seasons s
                  where s.id = season_id and private.is_group_member(s.group_id)));

-- ---------------------------------------------------------------------------
-- Helpers (no access check: callers check)
-- ---------------------------------------------------------------------------

-- Today in a season's time zone.
create function private.season_today(p_time_zone text)
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone p_time_zone)::date;
$$;

-- Whether a participant's season goals are locked: the season is not cancelled and it has
-- started (late entrants: they marked themselves ready).
create function private.season_member_locked(p_season_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.cancelled_at is null
            and case when m.late_entry then m.ready_at is not null
                     else private.season_today(s.time_zone) >= s.starts_on end
       from public.seasons s
       join public.season_members m on m.season_id = s.id
      where s.id = p_season_id and m.user_id = p_user_id),
    false);
$$;

create function private.season_goal_locked(p_goal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.season_goals sg
                  where sg.goal_id = p_goal_id
                    and private.season_member_locked(sg.season_id, sg.user_id));
$$;

-- The season's required metrics a participant has no (not archived) season goal for, in
-- the season's order.
create function private.season_missing_metrics(p_season_id uuid, p_user_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array(
    select r.metric
      from public.seasons s
     cross join lateral unnest(s.required_metrics) with ordinality r (metric, n)
     where s.id = p_season_id
       and not exists (select 1 from public.season_goals sg
                         join public.goals g on g.id = sg.goal_id
                        where sg.season_id = s.id and sg.user_id = p_user_id
                          and g.metric = r.metric and g.archived_at is null)
     order by r.n), '{}');
$$;

-- A season goal keeps one version, valid from its start (the setup's edits all describe
-- the same goal; a linked older goal starts over with its latest values).
create function private.season_goal_reset_versions(p_goal_id uuid, p_from date)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.goal_versions v
   where v.goal_id = p_goal_id
     and v.valid_from <> (select max(x.valid_from) from public.goal_versions x
                           where x.goal_id = p_goal_id);
  update public.goal_versions v set valid_from = p_from where v.goal_id = p_goal_id;
$$;

-- Metric keys without repeats, in their first order (null: none).
create function private.distinct_metrics(p_metrics text[])
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array(select r.m from unnest(p_metrics) with ordinality r (m, n)
                         group by r.m order by min(r.n)), '{}');
$$;

-- Validates a season's period, setup day and rules (raises).
create function private.check_season(
  p_group_id uuid,
  p_season_id uuid,
  p_name text,
  p_setup_opens_on date,
  p_starts_on date,
  p_ends_on date,
  p_checkin_every_weeks integer,
  p_required_metrics text[]
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_name is null or char_length(btrim(p_name)) not between 1 and 60 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if p_starts_on is null or p_ends_on is null or p_ends_on <= p_starts_on then
    raise exception 'invalid_period' using errcode = '22023';
  end if;
  if p_setup_opens_on is null or p_setup_opens_on > p_starts_on then
    raise exception 'invalid_setup_date' using errcode = '22023';
  end if;
  if p_checkin_every_weeks is not null and p_checkin_every_weeks not between 1 and 12 then
    raise exception 'invalid_checkin_rule' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(coalesce(p_required_metrics, '{}')) r (metric)
              where not exists (select 1 from public.goal_metrics m where m.key = r.metric)) then
    raise exception 'unknown_metric' using errcode = '22023';
  end if;
  if exists (select 1 from public.seasons s
              where s.group_id = p_group_id
                and s.id is distinct from p_season_id
                and s.cancelled_at is null
                and daterange(s.starts_on, s.ends_on, '[]')
                    && daterange(p_starts_on, p_ends_on, '[]')) then
    raise exception 'season_overlaps' using errcode = '22023';
  end if;
end;
$$;

-- Sets the period of a participant's season goals to own start → season end (one version
-- from the start).
create function private.season_member_goal_periods(p_season_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_goal uuid;
  v_start date;
  v_end date;
begin
  select m.starts_on, s.ends_on into v_start, v_end
    from public.season_members m join public.seasons s on s.id = m.season_id
   where m.season_id = p_season_id and m.user_id = p_user_id;
  for v_goal in select sg.goal_id from public.season_goals sg
                 where sg.season_id = p_season_id and sg.user_id = p_user_id loop
    update public.goals set starts_on = v_start, ends_on = v_end where id = v_goal;
    perform private.season_goal_reset_versions(v_goal, v_start);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- The lock: replaces the goals module's single editing check (see goals migration)
-- ---------------------------------------------------------------------------

-- Who may change a goal: its owner while it is not a locked season goal (raises
-- season_goal_locked then), or a group admin of the goal's season inside
-- correct_season_goal (which marks the goal for this transaction).
create or replace function private.can_edit_goal(p_goal_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select g.user_id into v_owner from public.goals g where g.id = p_goal_id;
  if v_owner is null then
    return false;
  end if;
  if current_setting('app.season_correction', true) = p_goal_id::text
     and exists (select 1 from public.season_goals sg
                   join public.seasons s on s.id = sg.season_id
                  where sg.goal_id = p_goal_id and private.is_group_admin(s.group_id)) then
    return true;
  end if;
  if v_owner <> (select auth.uid()) then
    return false;
  end if;
  if private.season_goal_locked(p_goal_id) then
    raise exception 'season_goal_locked' using errcode = '42501';
  end if;
  return true;
end;
$$;
revoke all on function private.can_edit_goal(uuid) from public, anon, authenticated;

-- A season goal keeps the season's period and stays shared; archiving one (possible only
-- while it is not locked) takes it out of the season.
create function private.goals_season_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start date;
  v_end date;
begin
  select m.starts_on, s.ends_on into v_start, v_end
    from public.season_goals sg
    join public.season_members m on m.season_id = sg.season_id and m.user_id = sg.user_id
    join public.seasons s on s.id = sg.season_id
   where sg.goal_id = new.id;
  if not found then
    return new;
  end if;
  if new.archived_at is not null and old.archived_at is null then
    delete from public.season_goals sg where sg.goal_id = new.id;
    return new;
  end if;
  if (new.starts_on, new.ends_on) is distinct from (old.starts_on, old.ends_on)
     and (new.starts_on, new.ends_on) is distinct from (v_start, v_end) then
    raise exception 'season_goal_period_fixed' using errcode = '22023';
  end if;
  if new.visibility <> 'shared' then
    raise exception 'season_goal_must_be_shared' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger goals_season_rules
  before update on public.goals
  for each row execute function private.goals_season_rules();

-- Taking a goal out of the season takes back "Bereit" when a required metric is missing.
create function private.on_season_goal_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.season_members m
     set ready_at = null
   where m.season_id = old.season_id and m.user_id = old.user_id
     and m.ready_at is not null
     and cardinality(private.season_missing_metrics(old.season_id, old.user_id)) > 0;
  return null;
end;
$$;

create trigger season_goals_after_delete
  after delete on public.season_goals
  for each row execute function private.on_season_goal_deleted();

-- ---------------------------------------------------------------------------
-- Target types (commentable; push jump targets) and feed events
-- ---------------------------------------------------------------------------

-- A season: visible to its group's members; its "owner" is the admin who created it.
create function private.season_target_visible(p_target_id uuid, p_group_id uuid, p_viewer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.seasons s
                  where s.id = p_target_id and s.group_id = p_group_id)
     and private.is_member(p_group_id, p_viewer_id);
$$;

create function private.season_target_owner(p_target_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.created_by from public.seasons s where s.id = p_target_id;
$$;

-- A goal: its owner, or – when shared and not archived – the members of a group the owner
-- belongs to (as goal_progress shows it).
create function private.goal_target_visible(p_target_id uuid, p_group_id uuid, p_viewer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.goals g
                  where g.id = p_target_id
                    and g.archived_at is null
                    and (g.user_id = p_viewer_id
                         or (g.visibility = 'shared' and private.is_member(p_group_id, g.user_id))))
     and private.is_member(p_group_id, p_viewer_id);
$$;

create function private.goal_target_owner(p_target_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select g.user_id from public.goals g where g.id = p_target_id;
$$;

insert into public.target_types (key, module, can_view_fn, owner_fn) values
  ('season', 'seasons', 'private.season_target_visible', 'private.season_target_owner'),
  ('goal', 'goals', 'private.goal_target_visible', 'private.goal_target_owner');

insert into public.feed_event_types (key, description) values
  ('season_announced', 'An admin created a season (setup opens)'),
  ('season_started', 'A season started: its goals are locked'),
  ('season_goal_corrected', 'An admin corrected a locked season goal');

-- season_started once per season.
create unique index feed_events_season_started_once
  on public.feed_events (target_id)
  where type = 'season_started';

-- Season events get their own small card (not the admin's day card).
alter table public.feed_days drop constraint feed_days_kind_check;
alter table public.feed_days
  add constraint feed_days_kind_check check (kind in ('day', 'joined', 'season'));

create or replace function private.feed_events_assign_day()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.occurred_at := coalesce(new.occurred_at, new.created_at, now());
  insert into public.feed_days (group_id, actor_id, day, kind)
  values (new.group_id, new.actor_id, private.local_day(new.actor_id, new.occurred_at),
          case when new.type = 'member_joined' then 'joined'
               when new.type like 'season\_%' then 'season'
               else 'day' end)
  on conflict (group_id, actor_id, day, kind) do update set day = excluded.day
  returning id into new.feed_day_id;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Notifications (category "seasons")
-- ---------------------------------------------------------------------------
insert into public.notification_categories
  (key, label, description, sort, in_important, in_standard) values
  ('seasons', 'Saisons', 'Neue Saison, Erinnerung ans Einrichten, Start und Korrekturen deiner Saisonziele.',
   100, true, true);

-- "Richte deine Ziele ein" to the participants whose setup is open (before the start; late
-- entrants until ready), once per season and person; p_skip: who caused it (no push to
-- yourself). p_actor: shown as the sender. Returns how many were queued.
create function private.notify_season_setup(
  p_season_id uuid,
  p_today date,
  p_actor uuid,
  p_skip uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with due as (
    select m.user_id, s.group_id, s.name
      from public.seasons s
      join public.season_members m on m.season_id = s.id
     where s.id = p_season_id
       and s.cancelled_at is null
       and p_today <= s.ends_on
       and case when m.late_entry then m.ready_at is null
                else p_today >= s.setup_opens_on and p_today < s.starts_on end
       and m.user_id is distinct from p_skip
       and not exists (select 1 from public.season_notification_log l
                        where l.season_id = s.id and l.user_id = m.user_id
                          and l.event = 'season_setup')
  ),
  sent as (
    insert into public.notifications
      (recipient_id, group_id, category, event, actor_id, target_type, target_id, data)
    select d.user_id, d.group_id, 'seasons', 'season_setup', p_actor, 'season', p_season_id,
           jsonb_build_object('preview', format('%s · Richte jetzt deine Ziele ein', d.name))
      from due d
    returning recipient_id
  )
  insert into public.season_notification_log (season_id, user_id, event)
  select p_season_id, recipient_id, 'season_setup' from sent;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- The hourly job (from 7:00 in the season's time zone):
--   * setup open: the setup push to those not reached yet (a setup opening later than the
--     creation, late entrants)
--   * the day before the start from 18:00: a reminder to participants not ready
--   * the start day: the feed card "Saison gestartet" (once) and a push to the participants
-- Returns the number of rows written (feed events and notifications).
create function private.run_season_jobs(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  s record;
  v_local timestamp;
  v_today date;
  v_actor uuid;
  v_count integer := 0;
  v_n integer;
begin
  for s in
    select x.* from public.seasons x
     where x.cancelled_at is null
       and x.ends_on >= (p_now at time zone x.time_zone)::date
     order by x.starts_on, x.id
  loop
    v_local := p_now at time zone s.time_zone;
    v_today := v_local::date;
    continue when v_local::time < time '07:00';
    v_actor := coalesce(
      s.created_by,
      (select gm.user_id from public.group_members gm
        where gm.group_id = s.group_id and gm.role = 'admin'
        order by gm.joined_at, gm.user_id limit 1));

    v_count := v_count + private.notify_season_setup(s.id, v_today, v_actor, s.created_by);

    if v_today = s.starts_on - 1 and v_local::time >= time '18:00' then
      with due as (
        select m.user_id from public.season_members m
         where m.season_id = s.id and not m.late_entry and m.ready_at is null
           and v_today >= s.setup_opens_on
           and not exists (select 1 from public.season_notification_log l
                            where l.season_id = s.id and l.user_id = m.user_id
                              and l.event = 'season_ready_reminder')
      ),
      sent as (
        insert into public.notifications
          (recipient_id, group_id, category, event, target_type, target_id, data)
        select d.user_id, s.group_id, 'seasons', 'season_ready_reminder', 'season', s.id,
               jsonb_build_object('preview', format('%s · Ziele einrichten und auf Bereit tippen', s.name))
          from due d
        returning recipient_id
      )
      insert into public.season_notification_log (season_id, user_id, event)
      select s.id, recipient_id, 'season_ready_reminder' from sent;
      get diagnostics v_n = row_count;
      v_count := v_count + v_n;
    end if;

    -- From the start day on, not only on it: a missed job run or a season created to start
    -- today still gets its card and push (once: unique index and log).
    if v_today >= s.starts_on and v_actor is not null then
      insert into public.feed_events (group_id, actor_id, type, target_type, target_id, data, occurred_at)
      values (s.group_id, v_actor, 'season_started', 'season', s.id,
              jsonb_build_object('seasonId', s.id), p_now)
      on conflict do nothing;
      get diagnostics v_n = row_count;
      v_count := v_count + v_n;

      with due as (
        select m.user_id from public.season_members m
         where m.season_id = s.id and not m.late_entry
           and not exists (select 1 from public.season_notification_log l
                            where l.season_id = s.id and l.user_id = m.user_id
                              and l.event = 'season_started')
      ),
      sent as (
        insert into public.notifications
          (recipient_id, group_id, category, event, target_type, target_id, data)
        select d.user_id, s.group_id, 'seasons', 'season_started', 'season', s.id,
               jsonb_build_object('preview', format('%s · Deine Ziele sind jetzt festgeschrieben', s.name))
          from due d
        returning recipient_id
      )
      insert into public.season_notification_log (season_id, user_id, event)
      select s.id, recipient_id, 'season_started' from sent;
      get diagnostics v_n = row_count;
      v_count := v_count + v_n;
    end if;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin: create, change, cancel, participants, corrections
-- ---------------------------------------------------------------------------

-- Creates a season of a group (group admins only). p_setup_opens_on null: today;
-- p_participants null: all group members; p_required_metrics null: the default
-- (trainings_per_week). The start must not be in the past; seasons of a group do not
-- overlap. Posts "season_announced" and pushes the setup to the participants (when it is
-- open). Returns the id.
create function public.create_season(
  p_id uuid,
  p_group_id uuid,
  p_name text,
  p_starts_on date,
  p_ends_on date,
  p_setup_opens_on date default null,
  p_participants uuid[] default null,
  p_weigh_weekly boolean default false,
  p_checkin_every_weeks integer default null,
  p_required_metrics text[] default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_tz text;
  v_today date;
  v_setup date;
  v_id uuid;
begin
  if v_user is null or not private.is_group_admin(p_group_id) then
    raise exception 'not_group_admin' using errcode = '42501';
  end if;
  v_tz := coalesce((select np.time_zone from public.notification_prefs np where np.user_id = v_user),
                   'Europe/Berlin');
  v_today := private.season_today(v_tz);
  v_setup := coalesce(p_setup_opens_on, v_today);
  if p_starts_on < v_today then
    raise exception 'start_in_the_past' using errcode = '22023';
  end if;
  if v_setup < v_today then
    raise exception 'invalid_setup_date' using errcode = '22023';
  end if;
  perform private.check_season(p_group_id, null, p_name, v_setup, p_starts_on, p_ends_on,
                               p_checkin_every_weeks, p_required_metrics);
  if p_participants is not null and exists (
       select 1 from unnest(p_participants) u (id) where not private.is_member(p_group_id, u.id)) then
    raise exception 'participant_not_in_group' using errcode = '22023';
  end if;
  if p_id is not null and exists (select 1 from public.seasons s where s.id = p_id) then
    raise exception 'season_id_taken' using errcode = '23505';
  end if;

  insert into public.seasons (id, group_id, name, setup_opens_on, starts_on, ends_on,
                              weigh_weekly, checkin_every_weeks, time_zone, created_by)
  values (coalesce(p_id, gen_random_uuid()), p_group_id, btrim(p_name), v_setup, p_starts_on,
          p_ends_on, coalesce(p_weigh_weekly, false), p_checkin_every_weeks, v_tz, v_user)
  returning id into v_id;
  if p_required_metrics is not null then
    update public.seasons
       set required_metrics = private.distinct_metrics(p_required_metrics)
     where id = v_id;
  end if;

  insert into public.season_members (season_id, user_id, starts_on)
  select v_id, gm.user_id, p_starts_on
    from public.group_members gm
   where gm.group_id = p_group_id
     and (p_participants is null or gm.user_id = any (p_participants));

  insert into public.feed_events (group_id, actor_id, type, target_type, target_id, data)
  values (p_group_id, v_user, 'season_announced', 'season', v_id, jsonb_build_object('seasonId', v_id));

  perform private.notify_season_setup(v_id, v_today, v_user, v_user);
  return v_id;
end;
$$;

-- Changes a season (group admins). Before the start everything; from the start day only the
-- name. Moving the start moves the participants' start and their goals' period with it;
-- changing the required metrics takes back "Bereit" of those now missing one.
create function public.update_season(
  p_season_id uuid,
  p_name text,
  p_starts_on date,
  p_ends_on date,
  p_setup_opens_on date,
  p_weigh_weekly boolean,
  p_checkin_every_weeks integer,
  p_required_metrics text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.seasons;
  v_today date;
  v_member record;
begin
  select * into s from public.seasons x where x.id = p_season_id;
  if not found or not private.is_group_admin(s.group_id) then
    raise exception 'not_group_admin' using errcode = '42501';
  end if;
  if s.cancelled_at is not null then
    raise exception 'season_cancelled' using errcode = '22023';
  end if;
  v_today := private.season_today(s.time_zone);

  if v_today >= s.starts_on then
    if p_starts_on is distinct from s.starts_on or p_ends_on is distinct from s.ends_on
       or p_setup_opens_on is distinct from s.setup_opens_on
       or p_weigh_weekly is distinct from s.weigh_weekly
       or p_checkin_every_weeks is distinct from s.checkin_every_weeks::integer
       or p_required_metrics is distinct from s.required_metrics then
      raise exception 'season_started' using errcode = '22023';
    end if;
    if p_name is null or char_length(btrim(p_name)) not between 1 and 60 then
      raise exception 'invalid_name' using errcode = '22023';
    end if;
    update public.seasons set name = btrim(p_name) where id = p_season_id;
    return;
  end if;

  if p_starts_on < v_today then
    raise exception 'start_in_the_past' using errcode = '22023';
  end if;
  perform private.check_season(s.group_id, s.id, p_name, p_setup_opens_on, p_starts_on,
                               p_ends_on, p_checkin_every_weeks, p_required_metrics);
  update public.seasons
     set name = btrim(p_name), starts_on = p_starts_on, ends_on = p_ends_on,
         setup_opens_on = p_setup_opens_on, weigh_weekly = coalesce(p_weigh_weekly, false),
         checkin_every_weeks = p_checkin_every_weeks,
         required_metrics = private.distinct_metrics(p_required_metrics)
   where id = p_season_id;
  update public.season_members m set starts_on = p_starts_on where m.season_id = p_season_id;
  if p_starts_on <> s.starts_on or p_ends_on <> s.ends_on then
    for v_member in select m.user_id from public.season_members m
                     where m.season_id = p_season_id order by m.user_id loop
      perform private.season_member_goal_periods(p_season_id, v_member.user_id);
    end loop;
  end if;
  update public.season_members m
     set ready_at = null
   where m.season_id = p_season_id and m.ready_at is not null
     and cardinality(private.season_missing_metrics(p_season_id, m.user_id)) > 0;
end;
$$;

-- Cancels a season that has not ended (group admins; the UI asks first). Its goals are
-- taken out of it and become ordinary goals again.
create function public.cancel_season(p_season_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.seasons;
begin
  select * into s from public.seasons x where x.id = p_season_id;
  if not found or not private.is_group_admin(s.group_id) then
    raise exception 'not_group_admin' using errcode = '42501';
  end if;
  if s.cancelled_at is not null then
    return;
  end if;
  if private.season_today(s.time_zone) > s.ends_on then
    raise exception 'season_ended' using errcode = '22023';
  end if;
  update public.seasons set cancelled_at = now() where id = p_season_id;
  delete from public.season_goals sg where sg.season_id = p_season_id;
end;
$$;

-- Adds a group member to a season (group admins). Before the start: with the season's
-- start. On or after the start day: a late entrant with their own start (p_starts_on,
-- default today; before the season's end) and their own setup until ready. Calling it for
-- a participant after the start turns them into a late entrant (a second chance for whoever
-- missed the setup): own start, not ready, goals moved to the new start and unlocked.
-- Pushes the setup to the person (once per season).
create function public.add_season_participant(
  p_season_id uuid,
  p_user_id uuid,
  p_starts_on date default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.seasons;
  v_today date;
  v_start date;
begin
  select * into s from public.seasons x where x.id = p_season_id;
  if not found or not private.is_group_admin(s.group_id) then
    raise exception 'not_group_admin' using errcode = '42501';
  end if;
  if s.cancelled_at is not null then
    raise exception 'season_cancelled' using errcode = '22023';
  end if;
  if not private.is_member(s.group_id, p_user_id) then
    raise exception 'participant_not_in_group' using errcode = '22023';
  end if;
  v_today := private.season_today(s.time_zone);
  if v_today >= s.ends_on then
    raise exception 'season_ended' using errcode = '22023';
  end if;

  if v_today < s.starts_on then
    if p_starts_on is not null and p_starts_on <> s.starts_on then
      raise exception 'late_start_only_after_start' using errcode = '22023';
    end if;
    insert into public.season_members (season_id, user_id, starts_on)
    values (p_season_id, p_user_id, s.starts_on)
    on conflict do nothing;
  else
    v_start := coalesce(p_starts_on, v_today);
    if v_start < s.starts_on or v_start >= s.ends_on then
      raise exception 'invalid_late_start' using errcode = '22023';
    end if;
    insert into public.season_members (season_id, user_id, starts_on, late_entry)
    values (p_season_id, p_user_id, v_start, true)
    on conflict (season_id, user_id) do update
      set starts_on = excluded.starts_on, late_entry = true, ready_at = null;
    perform private.season_member_goal_periods(p_season_id, p_user_id);
  end if;

  perform private.notify_season_setup(p_season_id, v_today, auth.uid(), auth.uid());
end;
$$;

-- Removes a participant (group admins; the UI asks first): their goals leave the season and
-- stay as ordinary goals.
create function public.remove_season_participant(p_season_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group uuid;
begin
  select s.group_id into v_group from public.seasons s where s.id = p_season_id;
  if v_group is null or not private.is_group_admin(v_group) then
    raise exception 'not_group_admin' using errcode = '42501';
  end if;
  delete from public.season_members m where m.season_id = p_season_id and m.user_id = p_user_id;
end;
$$;

-- Corrects the values of a locked season goal (group admins of its season). Start value,
-- minimum and target as in update_goal, from p_valid_from (default: the goal's start, i.e.
-- for the whole season). Posts "season_goal_corrected" (no values in it: the card reads the
-- goal, masked as for everyone) and tells the owner.
create function public.correct_season_goal(
  p_goal_id uuid,
  p_start_value numeric,
  p_min_value numeric,
  p_target_value numeric,
  p_valid_from date default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  g public.goals;
  v_season uuid;
  v_group uuid;
begin
  select sg.season_id, s.group_id into v_season, v_group
    from public.season_goals sg join public.seasons s on s.id = sg.season_id
   where sg.goal_id = p_goal_id;
  if v_season is null or not private.is_group_admin(v_group) then
    raise exception 'not_group_admin' using errcode = '42501';
  end if;
  if not private.season_goal_locked(p_goal_id) then
    raise exception 'season_goal_not_locked' using errcode = '22023';
  end if;
  select * into g from public.goals x where x.id = p_goal_id;

  perform set_config('app.season_correction', p_goal_id::text, true);
  perform public.update_goal(g.id, g.starts_on, g.ends_on, p_start_value, p_min_value,
                             p_target_value, g.visibility, coalesce(p_valid_from, g.starts_on));
  perform set_config('app.season_correction', '', true);

  insert into public.feed_events (group_id, actor_id, type, target_type, target_id, data)
  values (v_group, v_user, 'season_goal_corrected', 'goal', g.id,
          jsonb_build_object('seasonId', v_season, 'ownerId', g.user_id, 'metric', g.metric));

  if g.user_id <> v_user then
    insert into public.notifications
      (recipient_id, group_id, category, event, actor_id, target_type, target_id, data)
    values (g.user_id, v_group, 'seasons', 'season_goal_corrected', v_user, 'goal', g.id,
            jsonb_build_object('preview',
              (select m.label from public.goal_metrics m where m.key = g.metric),
              'seasonId', v_season));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Participants: link goals, ready
-- ---------------------------------------------------------------------------

-- Takes one of my goals into the season (while my setup is open: from setup_opens_on until
-- the start, as a late entrant until ready). The goal gets my season period (own start →
-- season end), becomes shared and keeps one version from the start. Idempotent.
create function public.link_season_goal(p_season_id uuid, p_goal_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  s public.seasons;
  m public.season_members;
  g public.goals;
  v_other uuid;
begin
  select * into s from public.seasons x where x.id = p_season_id;
  select * into m from public.season_members x
   where x.season_id = p_season_id and x.user_id = v_user;
  if s.id is null or m.user_id is null then
    raise exception 'not_participant' using errcode = '42501';
  end if;
  if s.cancelled_at is not null then
    raise exception 'season_cancelled' using errcode = '22023';
  end if;
  if private.season_member_locked(p_season_id, v_user) then
    raise exception 'season_goals_locked' using errcode = '22023';
  end if;
  if not m.late_entry and private.season_today(s.time_zone) < s.setup_opens_on then
    raise exception 'setup_not_open' using errcode = '22023';
  end if;
  select * into g from public.goals x where x.id = p_goal_id and x.user_id = v_user;
  if not found or g.archived_at is not null then
    raise exception 'goal_not_found' using errcode = '42501';
  end if;
  select sg.season_id into v_other from public.season_goals sg where sg.goal_id = p_goal_id;
  if v_other = p_season_id then
    return;
  elsif v_other is not null then
    raise exception 'goal_in_other_season' using errcode = '22023';
  end if;

  update public.goals set starts_on = m.starts_on, ends_on = s.ends_on, visibility = 'shared'
   where id = p_goal_id;
  perform private.season_goal_reset_versions(p_goal_id, m.starts_on);
  insert into public.season_goals (season_id, user_id, goal_id)
  values (p_season_id, v_user, p_goal_id);
end;
$$;

-- Takes one of my goals out of the season (until locked); it stays an ordinary goal.
create function public.unlink_season_goal(p_season_id uuid, p_goal_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if not exists (select 1 from public.season_goals sg
                  where sg.season_id = p_season_id and sg.goal_id = p_goal_id
                    and sg.user_id = v_user) then
    return;
  end if;
  if private.season_member_locked(p_season_id, v_user) then
    raise exception 'season_goals_locked' using errcode = '22023';
  end if;
  delete from public.season_goals sg where sg.season_id = p_season_id and sg.goal_id = p_goal_id;
end;
$$;

-- Marks me ready (or not) for a season. Ready needs a season goal for every required metric
-- (season_goals_missing). Until locked; a late entrant's goals lock when they are ready.
create function public.set_season_ready(p_season_id uuid, p_ready boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  s public.seasons;
begin
  select * into s from public.seasons x where x.id = p_season_id;
  if s.id is null or not exists (select 1 from public.season_members m
                                  where m.season_id = p_season_id and m.user_id = v_user) then
    raise exception 'not_participant' using errcode = '42501';
  end if;
  if s.cancelled_at is not null then
    raise exception 'season_cancelled' using errcode = '22023';
  end if;
  if private.season_member_locked(p_season_id, v_user) then
    raise exception 'season_goals_locked' using errcode = '22023';
  end if;
  if p_ready and cardinality(private.season_missing_metrics(p_season_id, v_user)) > 0 then
    raise exception 'season_goals_missing' using errcode = '22023';
  end if;
  update public.season_members m
     set ready_at = case when p_ready then coalesce(m.ready_at, now()) end
   where m.season_id = p_season_id and m.user_id = v_user;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reading (computed)
-- ---------------------------------------------------------------------------

-- The seasons of a group, newest start first, with what is computed for a day (p_today:
-- the viewer's today):
--   phase: cancelled · announced (setup not open yet) · setup · running · ended
--   week_number (while running) of week_count; days_until_start / days_until_end
--   participant_count, ready_count
--   mine: is_participant, my_starts_on, my_late_entry, my_ready_at, my_locked (now),
--     my_missing_metrics (required metrics I have no season goal for)
create function public.group_seasons(p_group_id uuid, p_today date default current_date)
returns table (
  id uuid,
  group_id uuid,
  name text,
  setup_opens_on date,
  starts_on date,
  ends_on date,
  weigh_weekly boolean,
  checkin_every_weeks integer,
  required_metrics text[],
  time_zone text,
  created_by uuid,
  cancelled_at timestamptz,
  created_at timestamptz,
  phase text,
  week_number integer,
  week_count integer,
  days_until_start integer,
  days_until_end integer,
  participant_count integer,
  ready_count integer,
  is_participant boolean,
  my_starts_on date,
  my_late_entry boolean,
  my_ready_at timestamptz,
  my_locked boolean,
  my_missing_metrics text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.group_id, s.name, s.setup_opens_on, s.starts_on, s.ends_on, s.weigh_weekly,
         s.checkin_every_weeks::integer, s.required_metrics, s.time_zone, s.created_by,
         s.cancelled_at, s.created_at,
         case when s.cancelled_at is not null then 'cancelled'
              when p_today > s.ends_on then 'ended'
              when p_today >= s.starts_on then 'running'
              when p_today >= s.setup_opens_on then 'setup'
              else 'announced' end,
         case when p_today between s.starts_on and s.ends_on
              then (p_today - s.starts_on) / 7 + 1 end,
         (s.ends_on - s.starts_on) / 7 + 1,
         s.starts_on - p_today,
         s.ends_on - p_today,
         (select count(*)::integer from public.season_members m where m.season_id = s.id),
         (select count(*)::integer from public.season_members m
           where m.season_id = s.id and m.ready_at is not null),
         me.user_id is not null,
         me.starts_on,
         me.late_entry,
         me.ready_at,
         case when me.user_id is not null then private.season_member_locked(s.id, me.user_id) end,
         case when me.user_id is not null then private.season_missing_metrics(s.id, me.user_id) end
    from public.seasons s
    left join public.season_members me
      on me.season_id = s.id and me.user_id = (select auth.uid())
   where s.group_id = p_group_id
     and (private.is_group_member(p_group_id) or private.is_super_admin())
   order by s.starts_on desc, s.id;
$$;

-- The participants of a season with their setup state: own start, late entry, ready, locked
-- (now), missing required metrics and how many season goals they have.
create function public.season_participants(p_season_id uuid)
returns table (
  user_id uuid,
  starts_on date,
  late_entry boolean,
  ready_at timestamptz,
  added_at timestamptz,
  locked boolean,
  missing_metrics text[],
  goal_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, m.starts_on, m.late_entry, m.ready_at, m.added_at,
         private.season_member_locked(m.season_id, m.user_id),
         private.season_missing_metrics(m.season_id, m.user_id),
         (select count(*)::integer from public.season_goals sg
            join public.goals g on g.id = sg.goal_id
           where sg.season_id = m.season_id and sg.user_id = m.user_id and g.archived_at is null)
    from public.season_members m
    join public.seasons s on s.id = m.season_id
   where m.season_id = p_season_id
     and (private.is_group_member(s.group_id) or private.is_super_admin())
   order by m.added_at, m.user_id;
$$;

-- Calendar markers of a group (computed): the start and end days of its seasons in a range
-- (not cancelled), by day.
create function public.season_day_markers(p_group_id uuid, p_from date, p_to date)
returns table (
  on_date date,
  kind text,
  season_id uuid,
  season_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select x.on_date, x.kind, s.id, s.name
    from public.seasons s
   cross join lateral (values (s.starts_on, 'season_start'), (s.ends_on, 'season_end'))
     x (on_date, kind)
   where s.group_id = p_group_id
     and s.cancelled_at is null
     and private.is_group_member(p_group_id)
     and x.on_date between p_from and p_to
   order by x.on_date, x.kind desc, s.id;
$$;

-- ---------------------------------------------------------------------------
-- Privileges and the job
-- ---------------------------------------------------------------------------
revoke all on function private.season_today(text) from public, anon, authenticated;
revoke all on function private.distinct_metrics(text[]) from public, anon, authenticated;
revoke all on function private.season_member_locked(uuid, uuid) from public, anon, authenticated;
revoke all on function private.season_goal_locked(uuid) from public, anon, authenticated;
revoke all on function private.season_missing_metrics(uuid, uuid) from public, anon, authenticated;
revoke all on function private.season_goal_reset_versions(uuid, date) from public, anon, authenticated;
revoke all on function private.check_season(uuid, uuid, text, date, date, date, integer, text[]) from public, anon, authenticated;
revoke all on function private.season_member_goal_periods(uuid, uuid) from public, anon, authenticated;
revoke all on function private.season_target_visible(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function private.season_target_owner(uuid) from public, anon, authenticated;
revoke all on function private.goal_target_visible(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function private.goal_target_owner(uuid) from public, anon, authenticated;
revoke all on function private.notify_season_setup(uuid, date, uuid, uuid) from public, anon, authenticated;
revoke all on function private.run_season_jobs(timestamptz) from public, anon, authenticated;

revoke all on function public.create_season(uuid, uuid, text, date, date, date, uuid[], boolean, integer, text[]) from public, anon;
revoke all on function public.update_season(uuid, text, date, date, date, boolean, integer, text[]) from public, anon;
revoke all on function public.cancel_season(uuid) from public, anon;
revoke all on function public.add_season_participant(uuid, uuid, date) from public, anon;
revoke all on function public.remove_season_participant(uuid, uuid) from public, anon;
revoke all on function public.correct_season_goal(uuid, numeric, numeric, numeric, date) from public, anon;
revoke all on function public.link_season_goal(uuid, uuid) from public, anon;
revoke all on function public.unlink_season_goal(uuid, uuid) from public, anon;
revoke all on function public.set_season_ready(uuid, boolean) from public, anon;
revoke all on function public.group_seasons(uuid, date) from public, anon;
revoke all on function public.season_participants(uuid) from public, anon;
revoke all on function public.season_day_markers(uuid, date, date) from public, anon;
grant execute on function public.create_season(uuid, uuid, text, date, date, date, uuid[], boolean, integer, text[]) to authenticated;
grant execute on function public.update_season(uuid, text, date, date, date, boolean, integer, text[]) to authenticated;
grant execute on function public.cancel_season(uuid) to authenticated;
grant execute on function public.add_season_participant(uuid, uuid, date) to authenticated;
grant execute on function public.remove_season_participant(uuid, uuid) to authenticated;
grant execute on function public.correct_season_goal(uuid, numeric, numeric, numeric, date) to authenticated;
grant execute on function public.link_season_goal(uuid, uuid) to authenticated;
grant execute on function public.unlink_season_goal(uuid, uuid) to authenticated;
grant execute on function public.set_season_ready(uuid, boolean) to authenticated;
grant execute on function public.group_seasons(uuid, date) to authenticated;
grant execute on function public.season_participants(uuid) to authenticated;
grant execute on function public.season_day_markers(uuid, date, date) to authenticated;

select cron.schedule('season-jobs', '7 * * * *', $cron$ select private.run_season_jobs(); $cron$);
