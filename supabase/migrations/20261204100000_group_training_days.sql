-- Baustein 8c-1 (comparison, social): the training days of a group's members in a range,
-- for the "Trainings" view of the group comparison (cumulative days per person).
--
-- A training day is a local day (in the viewer's time zone) with at least one finished
-- workout; a day counts once, however many workouts it has (like private.training_weeks).
-- Only members of the group get rows, and only for members whose trainings they may see:
-- the same gate as the workouts' own policy, private.can_view_user_data(owner, 'training').
-- Computed, nothing stored.

create function public.group_training_days(
  p_group_id uuid,
  p_from date,
  p_to date,
  p_time_zone text
)
returns table (
  user_id uuid,
  on_date date
)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct m.user_id, (w.started_at at time zone p_time_zone)::date
    from public.group_members m
    join public.workouts w on w.user_id = m.user_id
   where m.group_id = p_group_id
     and private.is_group_member(p_group_id)
     and private.can_view_user_data(m.user_id, 'training')
     and w.status = 'finished'
     -- A day of slack on each side for the time zone, then the exact local day.
     and w.started_at >= p_from - 1
     and w.started_at < p_to + 2
     and (w.started_at at time zone p_time_zone)::date between p_from and p_to
   order by 1, 2;
$$;

revoke all on function public.group_training_days(uuid, date, date, text) from public, anon;
grant execute on function public.group_training_days(uuid, date, date, text) to authenticated;
