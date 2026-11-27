-- Baustein 8b, follow-up: catch-up setup. Replaces "everyone is locked at the season
-- start" – which left whoever had not finished the setup by the start (the admin too)
-- without goals and without a way back – by:
--
--   * A participant's season goals are locked once the season has started AND they are
--     ready. Late entrants as before: locked once ready. A season that is over locks
--     everyone (not cancelled ones).
--   * At the start, a participant who is not ready but already had a season goal for every
--     required metric (linked before the start day) counts as ready: the lock treats them as
--     locked from the start day on (computed, so there is no gap), and the hourly job writes
--     their ready_at (independent of its 7:00 gate) so counts and lists agree.
--   * Whoever lacks a required goal at the start keeps an open setup after the start
--     ("catch-up"): they link goals and mark themselves ready, then they are locked. Their
--     goals keep the season's period (their start stays the season's start). Nobody else
--     has to do anything; the admin's "second chance" (add_season_participant again) stays.
--   * Taking "Bereit" back stays possible only before the start (after it, ready means
--     locked).
--
-- Every function that refused because "the setup is closed" reads the lock
-- (private.season_member_locked): link / unlink a goal, set ready, and through
-- private.can_edit_goal the goal's update, archive and discard. Replacing the lock and the
-- job is all it takes. The setup push now also reaches participants whose setup is open
-- after the start (a season created to start today); once per season and person as before.

-- Whether a participant had a (not archived) season goal for every required metric – and at
-- least one season goal – linked before the season's start day began (in its time zone).
create function private.season_member_complete_at_start(p_season_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with s as (
    select x.id, x.required_metrics,
           (x.starts_on::timestamp at time zone x.time_zone) as start_moment
      from public.seasons x
     where x.id = p_season_id
  ),
  early as (
    select g.metric
      from s
      join public.season_goals sg on sg.season_id = s.id and sg.user_id = p_user_id
      join public.goals g on g.id = sg.goal_id
     where g.archived_at is null and sg.created_at < s.start_moment
  )
  select exists (select 1 from s)
     and exists (select 1 from early)
     and not exists (select 1 from s cross join lateral unnest(s.required_metrics) r (metric)
                      where r.metric not in (select e.metric from early e));
$$;

-- Whether a participant's season goals are locked (see the rules above).
create or replace function private.season_member_locked(p_season_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.cancelled_at is null
            and (private.season_today(s.time_zone) > s.ends_on
                 or case when m.late_entry then m.ready_at is not null
                         else private.season_today(s.time_zone) >= s.starts_on
                              and (m.ready_at is not null
                                   or private.season_member_complete_at_start(s.id, m.user_id))
                    end)
       from public.seasons s
       join public.season_members m on m.season_id = s.id
      where s.id = p_season_id and m.user_id = p_user_id),
    false);
$$;

-- "Richte deine Ziele ein" to the participants whose setup is open on p_today and who are
-- not ready: from setup_opens_on (late entrants: from being added) – also after the start
-- for those who missed it (catch-up) – once per season and person; p_skip: who caused it.
create or replace function private.notify_season_setup(
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
       and m.ready_at is null
       and (m.late_entry
            or (p_today >= s.setup_opens_on
                and (p_today < s.starts_on
                     or not private.season_member_complete_at_start(s.id, m.user_id))))
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

-- The hourly job:
--   * from the start day on, at every run (not gated by 7:00): participants who are not
--     ready but had every required goal before the start are marked ready
--   * from 7:00 in the season's time zone:
--     - setup open: the setup push to those not reached yet
--     - the day before the start from 18:00: a reminder to participants not ready
--     - the start day: the feed card "Saison gestartet" (once) and a push to the
--       participants – "festgeschrieben" to the ready ones, "richte jetzt ein" to the others
-- Returns the number of rows written (ready marks, feed events and notifications).
create or replace function private.run_season_jobs(p_now timestamptz default now())
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

    if v_today >= s.starts_on then
      update public.season_members m
         set ready_at = p_now
       where m.season_id = s.id and not m.late_entry and m.ready_at is null
         and private.season_member_complete_at_start(s.id, m.user_id);
      get diagnostics v_n = row_count;
      v_count := v_count + v_n;
    end if;

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
        select m.user_id, m.ready_at is not null as ready from public.season_members m
         where m.season_id = s.id and not m.late_entry
           and not exists (select 1 from public.season_notification_log l
                            where l.season_id = s.id and l.user_id = m.user_id
                              and l.event = 'season_started')
      ),
      sent as (
        insert into public.notifications
          (recipient_id, group_id, category, event, target_type, target_id, data)
        select d.user_id, s.group_id, 'seasons', 'season_started', 'season', s.id,
               jsonb_build_object('preview',
                 case when d.ready then format('%s · Deine Ziele sind jetzt festgeschrieben', s.name)
                      else format('%s läuft · Richte jetzt deine Ziele ein', s.name) end)
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

revoke all on function private.season_member_complete_at_start(uuid, uuid) from public, anon, authenticated;
revoke all on function private.season_member_locked(uuid, uuid) from public, anon, authenticated;
revoke all on function private.notify_season_setup(uuid, date, uuid, uuid) from public, anon, authenticated;
revoke all on function private.run_season_jobs(timestamptz) from public, anon, authenticated;
