-- Training together in real time: a change to an exercise or set of a workout in a running
-- session sends a short signal to that session's private channel "live:<session id>". Only
-- the people in the session may listen. Workouts trained alone send nothing. The signal
-- carries no data; the app re-reads through the normal queries (and their rules).

create function private.on_live_workout_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workout uuid;
  v_session uuid;
begin
  if tg_table_name = 'workout_items' then
    v_workout := coalesce(new.workout_id, old.workout_id);
  else
    select i.workout_id into v_workout from public.workout_items i
     where i.id = coalesce(new.item_id, old.item_id);
  end if;
  v_session := private.live_session_of(v_workout);
  if v_session is not null then
    perform realtime.send(jsonb_build_object('workout_id', v_workout), 'changed',
                          'live:' || v_session::text, true);
  end if;
  return null;
end;
$$;

create trigger workout_items_after_change_broadcast
  after insert or update or delete on public.workout_items
  for each row execute function private.on_live_workout_changed();
create trigger workout_sets_after_change_broadcast
  after insert or update or delete on public.workout_sets
  for each row execute function private.on_live_workout_changed();

-- Who may listen: the people of that session.
create function private.can_listen_live(p_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_topic ~ '^live:[0-9a-f-]{36}$'
     and exists (select 1 from public.live_members m
                  where m.session_id = substring(p_topic from 6)::uuid
                    and m.user_id = (select auth.uid()));
$$;

grant execute on function private.can_listen_live(text) to authenticated;

create policy "live: session members listen" on realtime.messages
  for select to authenticated
  using (realtime.messages.extension = 'broadcast' and private.can_listen_live(realtime.topic()));
