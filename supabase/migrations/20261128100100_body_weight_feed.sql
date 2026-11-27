-- Baustein 7b (feed, social): the weight in the feed – once a week, only when shared.
--   weight_week: Monday morning, a look back at last week (on the person's Monday card),
--                only if the person shares their weight (percent or kg) and weighed at
--                least once that week (Mon–Sun). The figures are not stored: the card asks
--                the body module, so what is shown follows the current sharing.
-- Single weigh-ins never make a feed event, and this one makes no notification.
-- Posted by a job every hour from 7:00 local time (as habit_week); the unique index keeps
-- it to once per person, group and week. The body module knows nothing of this: the job
-- asks its public functions as the person.

insert into public.feed_event_types (key, description) values
  ('weight_week', 'Monday: how the shared weight went last week');

create unique index feed_events_weight_week_once
  on public.feed_events (group_id, actor_id, (data ->> 'weekStart'))
  where type = 'weight_week';

create function private.post_weight_feed(p_now timestamptz default now())
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
    select u.id as user_id,
           (p_now at time zone coalesce(np.time_zone, 'Europe/Berlin')) as local
      from auth.users u
      join public.body_settings bs on bs.user_id = u.id
      left join public.notification_prefs np on np.user_id = u.id
     where bs.weight_share <> 'private'
       and exists (select 1 from public.group_members gm where gm.user_id = u.id)
  loop
    continue when v_person.local::time < time '07:00';
    v_today := v_person.local::date;
    continue when extract(isodow from v_today) <> 1;
    v_week := v_today - 7;
    -- Ask the body module as the person (its functions check who is asking).
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_person.user_id, 'role', 'authenticated')::text, true);
    insert into public.feed_events (group_id, actor_id, type, data, occurred_at)
    select gm.group_id, v_person.user_id, 'weight_week',
           jsonb_build_object('weekStart', v_week), p_now
      from public.group_members gm
     where gm.user_id = v_person.user_id
       and (select s.days_with_entries
              from public.weight_summary(v_person.user_id, v_week, v_week + 6) s) > 0
    on conflict do nothing;
    get diagnostics v_n = row_count;
    v_count := v_count + v_n;
  end loop;
  perform set_config('request.jwt.claims', '', true);
  return v_count;
end;
$$;

revoke all on function private.post_weight_feed(timestamptz) from public, anon, authenticated;

select cron.schedule('weight-feed', '7 * * * *', $cron$ select private.post_weight_feed(); $cron$);
