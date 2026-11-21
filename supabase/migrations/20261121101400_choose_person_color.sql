-- People choose their own colour, as long as nobody they share a group with has it.
-- profiles.color stays closed for direct updates; this function is the only way.
--
-- Colours 7 and 8 got new values in the design tokens (terracotta, mustard): before, 7 was
-- nearly identical to 1 and 8 read as grey. Keys are unchanged, so no data migration.

create function public.set_my_color(p_color text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_color is null or p_color !~ '^person-[1-8]$' then
    raise exception 'invalid_color' using errcode = '22023';
  end if;
  if exists (
    select 1
      from public.group_members mine
      join public.group_members other on other.group_id = mine.group_id
      join public.profiles p on p.id = other.user_id
     where mine.user_id = v_user_id
       and other.user_id <> v_user_id
       and p.color = p_color
  ) then
    raise exception 'color_taken' using errcode = 'P0001';
  end if;
  update public.profiles set color = p_color where id = v_user_id;
end;
$$;

revoke all on function public.set_my_color(text) from public, anon;
grant execute on function public.set_my_color(text) to authenticated;
