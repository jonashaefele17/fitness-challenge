-- Habits (personal): one place that decides who may change a habit's definition, so a
-- season (social layer) can lock the rule of a season habit without the habits module
-- knowing about seasons (rule 13; same pattern as private.can_edit_goal).
--
--   private.can_edit_habit(habit_id): default – its owner. May raise to give a reason.
--
-- Asked by every change of the definition (save_habit on an existing habit: a new version)
-- and by archiving / bringing back. Sharing level, order, reminders and pauses stay free.

create function private.can_edit_habit(p_habit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.habits h
                  where h.id = p_habit_id and h.user_id = (select auth.uid()));
$$;
revoke all on function private.can_edit_habit(uuid) from public, anon, authenticated;

-- As before (Baustein 6a), but an existing habit is changed only through the hook.
create or replace function public.save_habit(
  p_habit_id uuid,
  p_template_id uuid,
  p_valid_from date,
  p_def jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_habit uuid := p_habit_id;
  v_t public.habit_templates%rowtype;
  -- The current definition: fields not given keep their value.
  v_b public.habit_versions%rowtype;
  v_first date;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_template_id is not null then
    select * into v_t from public.habit_templates where id = p_template_id;
    if not found then
      raise exception 'template_not_found' using errcode = 'P0001';
    end if;
  end if;

  if v_habit is null then
    insert into public.habits (user_id, template_id, sort)
    values (auth.uid(), p_template_id,
            coalesce((select max(sort) + 1 from public.habits where user_id = auth.uid()), 0))
    returning id into v_habit;
  elsif not private.can_edit_habit(v_habit) then
    raise exception 'habit_not_found' using errcode = '42501';
  end if;

  -- A change never reaches before the habit began.
  select min(valid_from) into v_first from public.habit_versions where habit_id = v_habit;
  select * into v_b from public.habit_versions
   where habit_id = v_habit and valid_from <= greatest(p_valid_from, coalesce(v_first, p_valid_from))
   order by valid_from desc limit 1;
  insert into public.habit_versions
    (habit_id, valid_from, name, input_type, unit, rule, frequency, weekdays, times_per_week,
     time_of_day, options, source)
  values (
    v_habit,
    greatest(p_valid_from, coalesce(v_first, p_valid_from)),
    coalesce(p_def ->> 'name', v_b.name, v_t.name),
    coalesce(p_def ->> 'input_type', v_b.input_type, v_t.input_type),
    case when p_def ? 'unit' then nullif(p_def ->> 'unit', '') else coalesce(v_b.unit, v_t.unit) end,
    coalesce(p_def -> 'rule', v_b.rule, v_t.rule, '[]'),
    coalesce(p_def ->> 'frequency', v_b.frequency, v_t.frequency, 'daily'),
    coalesce((select array_agg(x::smallint) from jsonb_array_elements_text(p_def -> 'weekdays') x),
             v_b.weekdays, v_t.weekdays, '{}'),
    case when p_def ? 'times_per_week' then (p_def ->> 'times_per_week')::smallint
         else coalesce(v_b.times_per_week, v_t.times_per_week) end,
    coalesce(p_def ->> 'time_of_day', v_b.time_of_day, v_t.time_of_day, 'evening'),
    coalesce(p_def -> 'options', v_b.options, v_t.options, '[]'),
    coalesce(p_def ->> 'source', v_b.source, v_t.source, 'manual'))
  on conflict (habit_id, valid_from) do update set
    name = excluded.name, input_type = excluded.input_type, unit = excluded.unit,
    rule = excluded.rule, frequency = excluded.frequency, weekdays = excluded.weekdays,
    times_per_week = excluded.times_per_week, time_of_day = excluded.time_of_day,
    options = excluded.options, source = excluded.source;
  return v_habit;
end;
$$;

-- Archive (no longer asked, history stays) or bring back – through the hook. Someone
-- else's habit: nothing happens, as before.
create or replace function public.archive_habit(p_habit_id uuid, p_archive boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_edit_habit(p_habit_id) then
    return;
  end if;
  update public.habits set archived_at = case when p_archive then now() end
   where id = p_habit_id;
end;
$$;
