-- Baustein 8b, follow-up: habits in a season (seasons, social). Replaces the goal metric
-- "Habit-Quote": a habit counts in a season with its own rule (e.g. sleep at least 7 h,
-- in bed before 23:00); the quota is only how it went, never a target.
--
--   season_habits: which habits of a participant count in the season. edit_open_until /
--                  edit_opened_by: an admin opened the rule for one change.
--
-- Rules:
--   * Linking and unlinking while the participant's setup is open – the same lock as the
--     season goals (private.season_member_locked).
--   * Fixed: while the season runs (not cancelled, not over) and the participant is locked,
--     the habit's definition cannot be changed and the habit cannot be archived. After the
--     end or a cancellation it is free again. Implemented by replacing
--     private.can_edit_habit, the habits module's one place for this, and a trigger on
--     archiving.
--   * The admin never changes someone else's habit: open_season_habit_edit opens the rule
--     for 24 hours; the owner changes it once – the change posts "season_habit_changed"
--     (feed, and a push to the admin) and closes it again. Past days keep the old rule
--     (a habit change is a new version from today, as always).
--   * The group sees name, rule and quota of a season habit (season_habits_overview), also
--     when the habit itself is private; single days stay behind the habit's own sharing.
--   * Removing a participant drops their links (foreign key), cancelling drops all.
--   * Former "Habit-Quote" season goals become season habits (the goals are archived by
--     the next migration).

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table public.season_habits (
  season_id uuid not null,
  user_id uuid not null,
  habit_id uuid not null references public.habits (id) on delete cascade,
  created_at timestamptz not null default now(),
  edit_open_until timestamptz,
  edit_opened_by uuid references public.profiles (id) on delete set null,
  primary key (season_id, habit_id),
  foreign key (season_id, user_id)
    references public.season_members (season_id, user_id) on delete cascade
);
create index season_habits_member_idx on public.season_habits (season_id, user_id);
create index season_habits_habit_idx on public.season_habits (habit_id);

alter table public.season_habits enable row level security;
revoke all on public.season_habits from anon, authenticated;
grant select on public.season_habits to authenticated;
create policy "season_habits: members of the season's group" on public.season_habits
  for select to authenticated
  using (exists (select 1 from public.seasons s
                  where s.id = season_id and private.is_group_member(s.group_id)));

-- Former habit quota goals of a season.
insert into public.season_habits (season_id, user_id, habit_id, created_at)
select sg.season_id, sg.user_id, g.habit_id, sg.created_at
  from public.season_goals sg
  join public.goals g on g.id = sg.goal_id
 where g.metric = 'habit_rate' and g.habit_id is not null and g.archived_at is null
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- The lock
-- ---------------------------------------------------------------------------

-- Whether a season fixes this link now: running (not cancelled, not over) and the
-- participant locked.
create function private.season_habit_link_fixed(p_season_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.seasons s
                  where s.id = p_season_id
                    and s.cancelled_at is null
                    and private.season_today(s.time_zone) <= s.ends_on
                    and private.season_member_locked(s.id, p_user_id));
$$;

-- Whether a habit's rule is fixed by a season now, ignoring an open edit window.
create function private.season_habit_fixed(p_habit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.season_habits sh
                  where sh.habit_id = p_habit_id
                    and private.season_habit_link_fixed(sh.season_id, sh.user_id));
$$;

-- Who may change a habit's definition: its owner, unless a running season fixes it
-- (raises season_habit_locked then) and no admin has opened it for a change.
create or replace function private.can_edit_habit(p_habit_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.habits h
                  where h.id = p_habit_id and h.user_id = (select auth.uid())) then
    return false;
  end if;
  if exists (select 1 from public.season_habits sh
              where sh.habit_id = p_habit_id
                and private.season_habit_link_fixed(sh.season_id, sh.user_id)
                and (sh.edit_open_until is null or sh.edit_open_until <= now())) then
    raise exception 'season_habit_locked' using errcode = '42501';
  end if;
  return true;
end;
$$;
revoke all on function private.can_edit_habit(uuid) from public, anon, authenticated;

-- Archiving a season habit: refused while fixed (also in an open edit window – the window
-- is for the rule); before that it leaves the seasons that have not ended.
create function private.habits_season_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.archived_at is not null and old.archived_at is null then
    if private.season_habit_fixed(new.id) then
      raise exception 'season_habit_locked' using errcode = '42501';
    end if;
    delete from public.season_habits sh
     using public.seasons s
     where sh.habit_id = new.id and s.id = sh.season_id
       and private.season_today(s.time_zone) <= s.ends_on;
  end if;
  return new;
end;
$$;

create trigger habits_season_rules
  before update on public.habits
  for each row execute function private.habits_season_rules();

-- A change of the rule inside an open window: posts it, tells the admin, closes the window.
create function private.on_season_habit_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select sh.season_id, sh.user_id, sh.edit_opened_by, s.group_id, s.name as season_name
      from public.season_habits sh
      join public.seasons s on s.id = sh.season_id
     where sh.habit_id = new.habit_id
       and sh.edit_open_until > now()
       and private.season_habit_link_fixed(sh.season_id, sh.user_id)
  loop
    insert into public.feed_events (group_id, actor_id, type, target_type, target_id, data)
    values (r.group_id, r.user_id, 'season_habit_changed', 'season', r.season_id,
            jsonb_build_object('seasonId', r.season_id, 'habitId', new.habit_id,
                               'name', new.name));
    if r.edit_opened_by is not null and r.edit_opened_by <> r.user_id then
      insert into public.notifications
        (recipient_id, group_id, category, event, actor_id, target_type, target_id, data)
      values (r.edit_opened_by, r.group_id, 'seasons', 'season_habit_changed', r.user_id,
              'season', r.season_id,
              jsonb_build_object('preview', format('%s · Regel geändert', new.name),
                                 'habitId', new.habit_id));
    end if;
    update public.season_habits sh
       set edit_open_until = null, edit_opened_by = null
     where sh.season_id = r.season_id and sh.habit_id = new.habit_id;
  end loop;
  return null;
end;
$$;

create trigger habit_versions_season_change
  after insert or update on public.habit_versions
  for each row execute function private.on_season_habit_version();

insert into public.feed_event_types (key, description) values
  ('season_habit_changed', 'Someone changed the rule of a season habit (opened by an admin)');

-- ---------------------------------------------------------------------------
-- Participants: link, unlink
-- ---------------------------------------------------------------------------

-- Takes one of my habits into the season (while my setup is open, as for goals).
-- Idempotent.
create function public.link_season_habit(p_season_id uuid, p_habit_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  s public.seasons;
  m public.season_members;
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
  if not exists (select 1 from public.habits h
                  where h.id = p_habit_id and h.user_id = v_user and h.archived_at is null) then
    raise exception 'habit_not_found' using errcode = '42501';
  end if;
  insert into public.season_habits (season_id, user_id, habit_id)
  values (p_season_id, v_user, p_habit_id)
  on conflict do nothing;
end;
$$;

-- Takes one of my habits out of the season (until locked); the habit stays as it is.
create function public.unlink_season_habit(p_season_id uuid, p_habit_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if not exists (select 1 from public.season_habits sh
                  where sh.season_id = p_season_id and sh.habit_id = p_habit_id
                    and sh.user_id = v_user) then
    return;
  end if;
  if private.season_member_locked(p_season_id, v_user) then
    raise exception 'season_goals_locked' using errcode = '22023';
  end if;
  delete from public.season_habits sh
   where sh.season_id = p_season_id and sh.habit_id = p_habit_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin: open a fixed rule for one change
-- ---------------------------------------------------------------------------

-- Opens the rule of a fixed season habit for 24 hours (group admins of the season). The
-- owner is told; their next change of the habit closes it again.
create function public.open_season_habit_edit(p_season_id uuid, p_habit_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  sh public.season_habits;
  v_group uuid;
  v_until timestamptz := now() + interval '24 hours';
begin
  select s.group_id into v_group from public.seasons s where s.id = p_season_id;
  if v_group is null or not private.is_group_admin(v_group) then
    raise exception 'not_group_admin' using errcode = '42501';
  end if;
  select * into sh from public.season_habits x
   where x.season_id = p_season_id and x.habit_id = p_habit_id;
  if not found then
    raise exception 'season_habit_not_found' using errcode = '22023';
  end if;
  if not private.season_habit_link_fixed(sh.season_id, sh.user_id) then
    raise exception 'season_habit_not_locked' using errcode = '22023';
  end if;

  update public.season_habits x
     set edit_open_until = v_until, edit_opened_by = v_user
   where x.season_id = p_season_id and x.habit_id = p_habit_id;

  if sh.user_id <> v_user then
    insert into public.notifications
      (recipient_id, group_id, category, event, actor_id, target_type, target_id, data)
    values (sh.user_id, v_group, 'seasons', 'season_habit_edit_open', v_user, 'season', p_season_id,
            jsonb_build_object(
              'preview', format('%s · 24 Stunden lang änderbar',
                                (select v.name from public.habit_versions v
                                  where v.habit_id = p_habit_id
                                  order by v.valid_from desc limit 1)),
              'habitId', p_habit_id));
  end if;
  return v_until;
end;
$$;

-- Cancelling also drops the season habits (they are free again anyway).
create or replace function public.cancel_season(p_season_id uuid)
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
  delete from public.season_habits sh where sh.season_id = p_season_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reading (computed)
-- ---------------------------------------------------------------------------

-- The season habits of all participants (members of the season's group): the rule valid
-- on p_today (name, input type, unit, rule, frequency, …) and how it went from the
-- participant's start up to p_today (at most the season's end), counted as in the habit
-- statistics (pauses and open days do not count; weekly habits by ended weeks).
--   locked: the rule is fixed now · edit_open_until: an admin opened it until then
create function public.season_habits_overview(
  p_season_id uuid,
  p_today date default current_date,
  p_time_zone text default 'Europe/Berlin'
)
returns table (
  user_id uuid,
  habit_id uuid,
  name text,
  input_type text,
  unit text,
  rule jsonb,
  frequency text,
  weekdays smallint[],
  times_per_week smallint,
  options jsonb,
  source text,
  counted integer,
  met integer,
  quota_pct numeric,
  count_unit text,
  locked boolean,
  edit_open_until timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select sh.user_id, sh.habit_id, v.name, v.input_type, v.unit, v.rule, v.frequency,
         v.weekdays, v.times_per_week, v.options, v.source,
         coalesce(q.counted, 0), coalesce(q.met, 0), q.quota_pct, coalesce(q.count_unit, 'days'),
         private.season_habit_link_fixed(sh.season_id, sh.user_id),
         case when sh.edit_open_until > now() then sh.edit_open_until end
    from public.season_habits sh
    join public.seasons s on s.id = sh.season_id
    join public.season_members m on m.season_id = sh.season_id and m.user_id = sh.user_id
    cross join lateral (
      select x.* from public.habit_versions x
       where x.habit_id = sh.habit_id
       order by case when x.valid_from <= p_today then x.valid_from end desc nulls last,
                x.valid_from
       limit 1
    ) v
    left join lateral private.goal_habit_quota(
      sh.user_id, sh.habit_id, m.starts_on, least(p_today, s.ends_on), p_today, p_time_zone) q
      on true
   where sh.season_id = p_season_id
     and (private.is_group_member(s.group_id) or private.is_super_admin())
   order by m.added_at, sh.user_id, sh.created_at, sh.habit_id;
$$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
revoke all on function private.season_habit_link_fixed(uuid, uuid) from public, anon, authenticated;
revoke all on function private.season_habit_fixed(uuid) from public, anon, authenticated;
revoke all on function private.habits_season_rules() from public, anon, authenticated;
revoke all on function private.on_season_habit_version() from public, anon, authenticated;
revoke all on function public.link_season_habit(uuid, uuid) from public, anon;
revoke all on function public.unlink_season_habit(uuid, uuid) from public, anon;
revoke all on function public.open_season_habit_edit(uuid, uuid) from public, anon;
revoke all on function public.season_habits_overview(uuid, date, text) from public, anon;
grant execute on function public.link_season_habit(uuid, uuid) to authenticated;
grant execute on function public.unlink_season_habit(uuid, uuid) to authenticated;
grant execute on function public.open_season_habit_edit(uuid, uuid) to authenticated;
grant execute on function public.season_habits_overview(uuid, date, text) to authenticated;
