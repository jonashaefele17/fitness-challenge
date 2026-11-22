-- Baustein 6d-3 (feed, social): habits in the feed – only shared ones, no daily check-ins.
--   habit_week:      Monday morning, a look back at last week (on the person's Monday card).
--                    The figures are not stored: the card asks the habits module, so what
--                    is shown follows the current sharing.
--   habit_milestone: a run of 7 / 30 / 100 / 365 days (weekly habits: 4 / 12 / 26 / 52 weeks),
--                    counted forgivingly as in habit_stats. Each milestone once per habit,
--                    even if the run breaks and starts again.
-- Posted by a job every hour from 7:00 local time; the unique indexes keep it to once.
-- The habits module knows nothing of this: the job asks its public functions as the person.

insert into public.feed_event_types (key, description) values
  ('habit_week', 'Monday: how last week went with the shared habits'),
  ('habit_milestone', 'A shared habit kept up for 7 / 30 / 100 days (or 4 / 12 / 26 weeks)');

create unique index feed_events_habit_week_once
  on public.feed_events (group_id, actor_id, (data ->> 'weekStart'))
  where type = 'habit_week';
create unique index feed_events_habit_milestone_once
  on public.feed_events (group_id, actor_id, target_id, (data ->> 'milestone'))
  where type = 'habit_milestone';

create function private.post_habit_feed(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_person record;
  v_count integer := 0;
  v_n integer;
  v_today date;
  v_week date;
begin
  for v_person in
    select u.id as user_id, coalesce(np.time_zone, 'Europe/Berlin') as tz,
           (p_now at time zone coalesce(np.time_zone, 'Europe/Berlin')) as local
      from auth.users u
      left join public.notification_prefs np on np.user_id = u.id
     where exists (select 1 from public.habits h
                    where h.user_id = u.id and h.archived_at is null and h.share_level <> 'private')
       and exists (select 1 from public.group_members gm where gm.user_id = u.id)
  loop
    continue when v_person.local::time < time '07:00';
    v_today := v_person.local::date;
    -- Ask the habits module as the person (its functions check who is asking).
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_person.user_id, 'role', 'authenticated')::text, true);

    -- Monday: last week, if a shared habit had something to answer.
    if extract(isodow from v_today) = 1 then
      v_week := v_today - 7;
      insert into public.feed_events (group_id, actor_id, type, data, occurred_at)
      select gm.group_id, v_person.user_id, 'habit_week',
             jsonb_build_object('weekStart', v_week), p_now
        from public.group_members gm
       where gm.user_id = v_person.user_id
         and exists (
           select 1 from public.habit_stats(v_person.user_id, v_week, v_week + 6, v_week + 6, v_person.tz) s
             join public.habits h on h.id = s.habit_id
            where h.share_level <> 'private' and h.archived_at is null and s.counted > 0)
      on conflict do nothing;
      get diagnostics v_n = row_count;
      v_count := v_count + v_n;
    end if;

    -- Milestones: runs up to yesterday (today may still be open).
    insert into public.feed_events (group_id, actor_id, type, target_type, target_id, data, occurred_at)
    select gm.group_id, v_person.user_id, 'habit_milestone', 'habit', m.habit_id,
           jsonb_build_object('milestone', m.milestone, 'unit', m.unit, 'name', m.name), p_now
      from (
        select s.habit_id, s.unit, v.name,
               (select max(t) from unnest(case when s.unit = 'weeks' then array[4, 12, 26, 52]
                                               else array[7, 30, 100, 365] end) t
                 where t <= s.current_streak) as milestone
          from public.habit_stats(v_person.user_id, v_today - 1, v_today - 1, v_today - 1, v_person.tz) s
          join public.habits h on h.id = s.habit_id
         cross join lateral (
           select v.name from public.habit_versions v
            where v.habit_id = h.id order by v.valid_from desc limit 1
         ) v
         where h.share_level <> 'private' and h.archived_at is null
      ) m
      join public.group_members gm on gm.user_id = v_person.user_id
     where m.milestone is not null
    on conflict do nothing;
    get diagnostics v_n = row_count;
    v_count := v_count + v_n;
  end loop;
  perform set_config('request.jwt.claims', '', true);
  return v_count;
end;
$$;

revoke all on function private.post_habit_feed(timestamptz) from public, anon, authenticated;

select cron.schedule('habit-feed', '7 * * * *', $cron$ select private.post_habit_feed(); $cron$);
