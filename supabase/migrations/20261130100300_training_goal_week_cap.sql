-- Baustein 8a (goals, personal): trainings per week – a week counts at most up to its
-- target. Before, the plain sum was compared with what the weeks asked for, so three weeks
-- of 6 trainings covered two weeks of none at "4 per week". Now more than the target does
-- not count extra; a week below the minimum can only be softened by weeks that reach the
-- full target. current_value is the average of the counted (capped) trainings per week, so
-- it agrees with the status.

create or replace function private.goal_figures(p_goal public.goals, p_today date, p_time_zone text)
returns table (
  evaluated_on date,
  phase text,
  min_value numeric,
  target_value numeric,
  current_value numeric,
  current_on date,
  expected_value numeric,
  progress_pct numeric,
  status text,
  on_track boolean,
  counted integer,
  min_met integer,
  target_met integer,
  count_unit text,
  week_done integer,
  week_min integer,
  week_target integer,
  best_weight_kg numeric,
  best_reps integer,
  best_duration_seconds integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  g public.goals := p_goal;
  v_eval date := least(p_today, p_goal.ends_on);
  v_phase text := case when p_today < p_goal.starts_on then 'upcoming'
                       when p_today > p_goal.ends_on then 'ended'
                       else 'running' end;
  v_version public.goal_versions;
  v_min numeric;
  v_target numeric;
  v_cur numeric;
  v_cur_on date;
  v_expected numeric;
  v_progress numeric;
  v_status text;
  v_on_track boolean;
  v_counted integer;
  v_min_met integer;
  v_target_met integer;
  v_unit text;
  v_week_done integer;
  v_week_min integer;
  v_week_target integer;
  v_best_kg numeric;
  v_best_reps integer;
  v_best_seconds integer;
  v_dir numeric;
  v_done_total integer;
  v_min_total integer;
  v_target_total integer;
begin
  v_version := private.goal_version_at(g.id, v_eval);
  v_min := v_version.min_value;
  v_target := v_version.target_value;

  if g.metric = 'trainings_per_week' then
    select count(*) filter (where w.finished and w.state <> 'paused')::integer,
           count(*) filter (where w.finished and w.state <> 'paused' and w.done >= w.min_needed)::integer,
           count(*) filter (where w.finished and w.state = 'target_reached')::integer,
           -- A week counts up to its target only: no saving up for later weeks.
           coalesce(sum(least(w.done, w.target_needed))
                      filter (where w.finished and w.state <> 'paused'), 0)::integer,
           coalesce(sum(w.min_needed) filter (where w.finished and w.state <> 'paused'), 0)::integer,
           coalesce(sum(w.target_needed) filter (where w.finished and w.state <> 'paused'), 0)::integer,
           max(w.done) filter (where not w.finished),
           max(w.min_needed) filter (where not w.finished),
           max(w.target_needed) filter (where not w.finished)
      into v_counted, v_min_met, v_target_met, v_done_total, v_min_total, v_target_total,
           v_week_done, v_week_min, v_week_target
      from private.goal_training_weeks(g, p_today, p_time_zone) w;
    v_unit := 'weeks';
    if v_min is null then
      v_min_met := null;
    end if;
    if v_counted > 0 then
      v_cur := round(v_done_total::numeric / v_counted, 1);
      v_progress := round(v_done_total * 100.0 / nullif(v_target_total, 0), 1);
      v_status := case
        when v_done_total >= v_target_total then 'target_reached'
        when v_min is null then 'not_reached'
        when v_done_total >= v_min_total then 'min_reached'
        else 'below_min'
      end;
      v_on_track := v_done_total >= case when v_min is null then v_target_total else v_min_total end;
    end if;

  elsif g.metric = 'habit_rate' then
    if v_eval >= g.starts_on then
      select q.counted, q.met, q.quota_pct, q.count_unit
        into v_counted, v_target_met, v_cur, v_unit
        from private.goal_habit_quota(g.user_id, g.habit_id, g.starts_on, v_eval, p_today, p_time_zone) q;
    end if;
    if v_cur is not null then
      v_progress := round(v_cur / nullif(v_target, 0) * 100, 1);
      v_status := case
        when v_cur >= v_target then 'target_reached'
        when v_min is null then 'not_reached'
        when v_cur >= v_min then 'min_reached'
        else 'below_min'
      end;
      v_on_track := v_cur >= coalesce(v_min, v_target);
    end if;

  else
    -- Levels
    if g.metric = 'body_weight' then
      select t.trend_kg, t.on_date into v_cur, v_cur_on
        from private.weight_trend(g.user_id, g.starts_on, v_eval) t
       order by t.on_date desc limit 1;
    elsif g.metric = 'body_measurement' then
      select m.value, c.on_date into v_cur, v_cur_on
        from public.body_measurements m
        join public.body_checkins c on c.id = m.checkin_id
       where c.user_id = g.user_id and m.kind = g.measurement_kind and not c.skipped
         and c.on_date between g.starts_on and v_eval
       order by c.on_date desc limit 1;
    elsif g.metric = 'exercise_best' then
      select x.value, x.on_date, x.weight_kg, x.reps, x.duration_seconds
        into v_cur, v_cur_on, v_best_kg, v_best_reps, v_best_seconds
        from private.goal_exercise_days(g.user_id, g.exercise_id, g.device_id, g.reps,
                                        g.starts_on, v_eval, p_time_zone) x
       order by x.value desc, x.on_date limit 1;
    end if;

    v_dir := sign(v_target - g.start_value);
    v_expected := round(g.start_value + (v_target - g.start_value)
                    * least(greatest(v_eval - g.starts_on, 0), g.ends_on - g.starts_on)::numeric
                    / (g.ends_on - g.starts_on), 2);
    if v_cur is not null and v_dir <> 0 then
      v_progress := round((v_cur - g.start_value) / (v_target - g.start_value) * 100, 1);
      v_status := case
        when (v_cur - v_target) * v_dir >= 0 then 'target_reached'
        when v_min is null then 'not_reached'
        when (v_cur - v_min) * v_dir >= 0 then 'min_reached'
        else 'below_min'
      end;
      v_on_track := (v_cur - v_expected) * v_dir >= 0;
    end if;
  end if;

  return query select v_eval, v_phase, v_min, v_target, v_cur, v_cur_on, v_expected, v_progress,
                      v_status, v_on_track, v_counted, v_min_met, v_target_met, v_unit,
                      v_week_done, v_week_min, v_week_target, v_best_kg, v_best_reps,
                      v_best_seconds;
end;
$$;

update public.goal_metrics
   set description = 'Wie oft du pro Woche trainierst. Mehr als das Ziel zählt in einer Woche nicht extra, Pausen verkleinern sie.'
 where key = 'trainings_per_week';
