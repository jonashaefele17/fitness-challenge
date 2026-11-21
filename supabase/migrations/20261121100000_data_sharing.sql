-- Glue between personal modules and the social layer (CLAUDE.md rule 13).
--
-- Personal tables never look at groups. They ask this one function whether the current
-- user may see data of a given owner and kind ('training', 'habits', 'body' …).
-- In this app: the owner, or anyone sharing a group with the owner. Per-group and
-- per-kind sharing settings can be added here later without touching personal modules.
-- In a solo app this function is simply: p_owner = auth.uid().

create function private.can_view_user_data(p_owner uuid, p_kind text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_owner = (select auth.uid())
      or (p_kind is not null and private.shares_group_with(p_owner));
$$;

revoke all on function private.can_view_user_data(uuid, text) from public;
grant execute on function private.can_view_user_data(uuid, text) to authenticated;
