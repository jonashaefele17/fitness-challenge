-- Baustein 8a (goals, personal): "Rückgängig" right after creating a goal removes it
-- without a trace, instead of leaving it among the ended goals. Only within a short time
-- after creating; later a goal is archived, never deleted.

create function public.discard_goal(p_goal_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_edit_goal(p_goal_id) then
    raise exception 'goal_not_found' using errcode = '42501';
  end if;
  delete from public.goals g
   where g.id = p_goal_id and g.created_at > now() - interval '10 minutes';
  if not found then
    raise exception 'goal_too_old_to_discard' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.discard_goal(uuid) from public, anon;
grant execute on function public.discard_goal(uuid) to authenticated;
