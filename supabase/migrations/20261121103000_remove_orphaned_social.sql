-- Social layer: when the object goes, its comments, reactions, notifications and read
-- markers go too (nothing points into the void). Covers workouts, their exercises and sets
-- (a set = the exercise + its position as index) and day cards.

create function private.remove_target_social(p_type text, p_id uuid, p_index integer, p_all boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  -- p_all: every index of the object (it is gone); else only this index (one set).
  delete from public.comments c
   where c.target_type = p_type and c.target_id = p_id
     and (p_all or c.target_index is not distinct from p_index);
  delete from public.reactions r
   where r.target_type = p_type and r.target_id = p_id
     and (p_all or r.target_index is not distinct from p_index);
  delete from public.notifications n
   where n.target_type = p_type and n.target_id = p_id
     and (p_all or n.target_index is not distinct from p_index);
  delete from public.read_markers m
   where m.target_type = p_type and m.target_id = p_id
     and (p_all or m.target_index is not distinct from p_index);
$$;

create function private.on_workout_item_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.remove_target_social('workout_item', old.id, null, true);
  return old;
end;
$$;
create trigger workout_items_after_delete_social
  after delete on public.workout_items
  for each row execute function private.on_workout_item_deleted();

create function private.on_workout_set_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.remove_target_social('workout_item', old.item_id, old.position, false);
  return old;
end;
$$;
create trigger workout_sets_after_delete_social
  after delete on public.workout_sets
  for each row execute function private.on_workout_set_deleted();

create function private.on_workout_deleted_social()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.remove_target_social('workout', old.id, null, true);
  return old;
end;
$$;
create trigger workouts_after_delete_social
  after delete on public.workouts
  for each row execute function private.on_workout_deleted_social();

create function private.on_feed_day_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.remove_target_social('feed_day', old.id, null, true);
  return old;
end;
$$;
create trigger feed_days_after_delete_social
  after delete on public.feed_days
  for each row execute function private.on_feed_day_deleted();

-- Clean up what is already pointing into the void.
delete from public.comments c
 where (c.target_type = 'workout' and not exists (select 1 from public.workouts w where w.id = c.target_id))
    or (c.target_type = 'workout_item' and not exists (select 1 from public.workout_items i where i.id = c.target_id))
    or (c.target_type = 'feed_day' and not exists (select 1 from public.feed_days d where d.id = c.target_id));
delete from public.reactions r
 where (r.target_type = 'workout' and not exists (select 1 from public.workouts w where w.id = r.target_id))
    or (r.target_type = 'workout_item' and not exists (select 1 from public.workout_items i where i.id = r.target_id))
    or (r.target_type = 'feed_day' and not exists (select 1 from public.feed_days d where d.id = r.target_id));
