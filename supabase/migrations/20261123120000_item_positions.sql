-- Training: the order of a workout's exercises in one call (one transaction), instead of one
-- update per exercise. Keeps the order consistent when it is saved quickly in a row.

create function public.set_item_positions(p_workout_id uuid, p_item_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.workouts w where w.id = p_workout_id and w.user_id = auth.uid()
  ) then
    raise exception 'workout_not_found' using errcode = '42501';
  end if;
  update public.workout_items i
     set position = o.position - 1
    from unnest(p_item_ids) with ordinality as o(id, position)
   where i.id = o.id and i.workout_id = p_workout_id
     and i.position is distinct from o.position - 1;
end;
$$;

revoke all on function public.set_item_positions(uuid, uuid[]) from public, anon;
grant execute on function public.set_item_positions(uuid, uuid[]) to authenticated;
