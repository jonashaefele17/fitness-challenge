-- Baustein 8c-3 (comparison, social): the habit quota per calendar week of a group's
-- members over their shared habits, for the quota lines in Vergleich → Habits (periods
-- 4 Wochen · 3 Monate · 1 Jahr; the period "Saison" reads season_habit_weeks instead).
--
-- Which habits: a member's habits shared with others (share_level done or values), not
-- archived – the same ones the habit matrix below shows, mine included. Scored by
-- private.habit_week_quota (the habit statistics' rules). Only the quota leaves: no names,
-- no values.
-- Access: the caller must be a member of the group (central helper), and a member's habits
-- count only as far as the caller may see them – the gate the habit sharing uses,
-- private.can_view_user_data(owner, 'habits'). Computed, nothing stored.

create function public.group_habit_weeks(
  p_group_id uuid,
  p_from date,
  p_to date,
  p_today date default current_date,
  p_time_zone text default 'Europe/Berlin'
)
returns table (
  user_id uuid,
  week_start date,
  quota_pct numeric,
  counted integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with people as (
    select m.user_id,
           array(select h.id from public.habits h
                  where h.user_id = m.user_id
                    and h.share_level <> 'private'
                    and h.archived_at is null) as habit_ids
      from public.group_members m
     where m.group_id = p_group_id
       and private.is_group_member(p_group_id)
       and (m.user_id = (select auth.uid()) or private.can_view_user_data(m.user_id, 'habits'))
  )
  select p.user_id, q.week_start, q.quota_pct, q.counted
    from people p
   cross join lateral private.habit_week_quota(
     p.user_id, p.habit_ids, p_from, p_to, p_today, p_time_zone) q
   where cardinality(p.habit_ids) > 0
   order by p.user_id, q.week_start;
$$;

revoke all on function public.group_habit_weeks(uuid, date, date, date, text) from public, anon;
grant execute on function public.group_habit_weeks(uuid, date, date, date, text) to authenticated;
