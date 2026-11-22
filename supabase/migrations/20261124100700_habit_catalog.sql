-- Baustein 6d (habits, personal): one catalog.
--   Standard templates (global, kept by the super admin) and, computed, every shared habit of
--   the people one shares a group with that was not taken from somewhere else ("von Grazon").
--   Nobody changes another's entry: it follows its owner's habit.
--   Taking one over makes an own copy (own goals) that remembers where it came from, so the
--   comparison puts them together.
--   The super admin can turn such a habit into a standard template: the habit and every copy
--   are moved over to it; entries, values and history stay untouched (they belong to the
--   people's habits, only the link changes).

alter table public.habits
  add column source_habit_id uuid references public.habits (id) on delete set null;
create index habits_source_idx on public.habits (source_habit_id);

-- Take over a shared habit as an own one (definition as given: own goals).
create function public.adopt_habit(p_source_id uuid, p_valid_from date, p_def jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.habits%rowtype;
  v_habit uuid;
begin
  select * into v_source from public.habits h
   where h.id = p_source_id and h.user_id <> auth.uid()
     and h.share_level <> 'private' and private.can_view_user_data(h.user_id, 'habits');
  if not found then
    raise exception 'habit_not_found' using errcode = '42501';
  end if;
  -- The definition: as given, the rest from the source's current version.
  v_habit := public.save_habit(null, null, p_valid_from,
    (select to_jsonb(v) - 'id' - 'habit_id' - 'valid_from' - 'created_at'
       from public.habit_versions v
      where v.habit_id = p_source_id and v.valid_from <= p_valid_from
      order by v.valid_from desc limit 1) || p_def);
  update public.habits
     set source_habit_id = coalesce(v_source.source_habit_id, v_source.id),
         template_id = v_source.template_id
   where id = v_habit;
  return v_habit;
end;
$$;

-- Turn a habit from the group into a standard template (super admin only).
create function public.promote_habit_to_template(p_habit_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_root uuid;
  v_version public.habit_versions%rowtype;
  v_template uuid;
begin
  if not private.is_super_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select coalesce(h.source_habit_id, h.id) into v_root from public.habits h where h.id = p_habit_id;
  if v_root is null then
    raise exception 'habit_not_found' using errcode = 'P0001';
  end if;
  select * into v_version from public.habit_versions v
   where v.habit_id = v_root order by v.valid_from desc limit 1;

  insert into public.habit_templates
    (name, input_type, unit, rule, frequency, weekdays, times_per_week, time_of_day, options, source, sort)
  values
    (v_version.name, v_version.input_type, v_version.unit, v_version.rule, v_version.frequency,
     v_version.weekdays, v_version.times_per_week, v_version.time_of_day, v_version.options,
     v_version.source, coalesce((select max(sort) + 10 from public.habit_templates), 100))
  returning id into v_template;

  update public.habits
     set template_id = v_template, source_habit_id = null
   where id = v_root or source_habit_id = v_root;
  return v_template;
end;
$$;

revoke all on function public.adopt_habit(uuid, date, jsonb) from public, anon;
revoke all on function public.promote_habit_to_template(uuid) from public, anon;
grant execute on function public.adopt_habit(uuid, date, jsonb) to authenticated;
grant execute on function public.promote_habit_to_template(uuid) to authenticated;
