-- Baustein 4b: comments and reactions on a workout, each exercise and each set.
-- An exercise of a workout is the target "workout_item"; a set is the same target with
-- target_index = the set's position. Activity there bumps the workout's day card.

create function private.workout_item_visible(p_target_id uuid, p_group_id uuid, p_viewer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workout_items i
      join public.workouts w on w.id = i.workout_id
     where i.id = p_target_id and w.status = 'finished'
       and private.is_member(p_group_id, w.user_id)
  ) and private.is_member(p_group_id, p_viewer_id);
$$;

-- Owner: private.item_owner (training module).
insert into public.target_types (key, module, can_view_fn, owner_fn) values
  ('workout_item', 'training', 'private.workout_item_visible', 'private.item_owner');

-- An exercise or set belongs to its workout: activity there counts for the workout's card.
create or replace function private.bump_feed_activity(p_group_id uuid, p_target_type text, p_target_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text := p_target_type;
  v_id uuid := p_target_id;
begin
  if p_target_type = 'workout_item' then
    v_type := 'workout';
    select i.workout_id into v_id from public.workout_items i where i.id = p_target_id;
  end if;

  update public.feed_events fe
     set last_activity_at = now()
   where fe.group_id = p_group_id
     and ((v_type = 'feed_event' and fe.id = v_id)
       or (fe.target_type = v_type and fe.target_id = v_id));
  update public.feed_days fd
     set last_activity_at = now()
   where fd.group_id = p_group_id
     and ((v_type = 'feed_day' and fd.id = v_id)
       or fd.id in (
         select fe.feed_day_id from public.feed_events fe
          where fe.group_id = p_group_id
            and ((v_type = 'feed_event' and fe.id = v_id)
              or (fe.target_type = v_type and fe.target_id = v_id))));
end;
$$;
