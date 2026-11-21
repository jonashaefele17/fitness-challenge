-- Set score for weight exercises: Lombardi (kg × reps^0.1) instead of Epley.
-- Reps count less, so double progression (70 × 12 → 72,5 × 8) no longer drops sharply and
-- 72,5 × 6 ranks above 70 × 8. Still a plain estimate: only for ordering and drawing.

create or replace function private.set_score(
  p_measure public.exercise_measure,
  p_weight_kg numeric,
  p_reps integer,
  p_duration_seconds integer
)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case p_measure
    when 'weight_reps' then
      case
        when p_weight_kg is null or p_reps is null or p_reps < 1 then null
        else round(p_weight_kg * power(p_reps::numeric, 0.1), 2)
      end
    when 'reps' then p_reps::numeric
    else p_duration_seconds::numeric
  end;
$$;
