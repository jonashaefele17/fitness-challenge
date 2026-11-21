-- Social layer for 4d: a workout added afterwards is "late" (no notification), and a
-- workout moved to another day moves to that day's card.

create or replace function private.on_workout_finished()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_late boolean := new.logged_later or new.ended_at < now() - interval '3 hours';
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

-- Moved in time: the feed event follows to the card of its (new) day.
create function private.on_workout_moved()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event record;
  v_day_id uuid;
begin
  if new.status <> 'finished' or new.started_at = old.started_at then
    return new;
  end if;
  for v_event in
    select fe.id, fe.group_id, fe.feed_day_id from public.feed_events fe
     where fe.target_type = 'workout' and fe.target_id = new.id
  loop
    insert into public.feed_days (group_id, actor_id, day, kind)
    values (v_event.group_id, new.user_id, private.local_day(new.user_id, new.started_at), 'day')
    on conflict (group_id, actor_id, day, kind) do update set day = excluded.day
    returning id into v_day_id;
    update public.feed_events
       set occurred_at = new.started_at, feed_day_id = v_day_id
     where id = v_event.id;
    delete from public.feed_days fd
     where fd.id = v_event.feed_day_id
       and not exists (select 1 from public.feed_events fe where fe.feed_day_id = fd.id);
  end loop;
  return new;
end;
$$;

create trigger workouts_after_move
  after update of started_at on public.workouts
  for each row execute function private.on_workout_moved();
