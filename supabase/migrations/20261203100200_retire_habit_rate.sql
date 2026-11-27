-- Goals (personal): the metric "Habit-Quote" is retired. A habit has its own rule; a quota
-- as a target on top of it measured the same thing twice (concept 1.52). In a season a
-- habit now counts with its rule (season habits, social layer).
--
--   goal_metrics.offered: false – no new goals of that metric (create_goal is refused by a
--   trigger, so every way in is covered). The computation stays, so archived goals of the
--   metric still read as before.
-- Existing quota goals (test data only) are archived; those that belonged to a season were
-- turned into season habits by the previous migration.

alter table public.goal_metrics add column offered boolean not null default true;
update public.goal_metrics set offered = false where key = 'habit_rate';

create function private.goals_metric_offered()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce((select m.offered from public.goal_metrics m where m.key = new.metric), false) then
    raise exception 'metric_not_offered' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function private.goals_metric_offered() from public, anon, authenticated;

create trigger goals_metric_offered
  before insert on public.goals
  for each row execute function private.goals_metric_offered();

update public.goals set archived_at = now()
 where metric = 'habit_rate' and archived_at is null;
