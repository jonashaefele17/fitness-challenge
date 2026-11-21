-- Training templates (3c).
--
-- A template belongs to exactly one person; only they edit it. Others who may see their
-- training data (private.can_view_user_data) can start with it directly (their own weights
-- come from their own history) or copy it. Exercises reference a device TYPE, so a template
-- works in every studio; at the start the device of that type at the place is chosen.
-- No weights are stored: progression suggests them from history and the rep range.
-- Templates are archived; deleting is allowed (workouts keep everything but the link).

create table public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  training_type_id uuid not null references public.training_types (id),
  focus_id uuid references public.training_focuses (id) on delete set null,
  name text not null check (char_length(btrim(name)) between 2 and 60),
  note text check (note is null or char_length(note) <= 500),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workout_templates_user_idx on public.workout_templates (user_id);

create trigger workout_templates_set_updated_at
  before update on public.workout_templates
  for each row execute function private.set_updated_at();

create table public.workout_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.workout_templates (id) on delete cascade,
  position integer not null check (position >= 0),
  exercise_id uuid not null references public.exercises (id),
  device_type_id uuid references public.device_types (id) on delete set null,
  sets integer not null default 3 check (sets between 1 and 20),
  warmup_sets integer not null default 0 check (warmup_sets between 0 and 5),
  rep_min integer check (rep_min is null or rep_min between 1 and 100),
  rep_max integer check (rep_max is null or rep_max between 1 and 100),
  -- Target time per set for duration exercises (planks, holds).
  duration_seconds integer check (duration_seconds is null or duration_seconds between 1 and 3600),
  note text check (note is null or char_length(note) <= 300),
  constraint workout_template_items_rep_range check (rep_min is null or rep_max is null or rep_min <= rep_max)
);
create index workout_template_items_template_idx on public.workout_template_items (template_id, position);

alter table public.workouts
  add column template_id uuid references public.workout_templates (id) on delete set null;
create index workouts_template_idx on public.workouts (template_id);

create function private.template_owner(p_template_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.user_id from public.workout_templates t where t.id = p_template_id;
$$;

-- ---------------------------------------------------------------------------
-- Privileges and RLS (writes go through the RPCs below; deletes directly)
-- ---------------------------------------------------------------------------
revoke all on public.workout_templates, public.workout_template_items from anon, authenticated;
grant select, delete on public.workout_templates to authenticated;
grant update (name, focus_id, note, archived_at) on public.workout_templates to authenticated;
grant select on public.workout_template_items to authenticated;

alter table public.workout_templates enable row level security;
alter table public.workout_template_items enable row level security;

create policy "workout_templates: own and shared" on public.workout_templates
  for select to authenticated
  using (private.can_view_user_data(user_id, 'training'));
create policy "workout_templates: owner edits" on public.workout_templates
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "workout_templates: owner deletes" on public.workout_templates
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "workout_template_items: with the template" on public.workout_template_items
  for select to authenticated
  using (private.can_view_user_data(private.template_owner(template_id), 'training'));

-- ---------------------------------------------------------------------------
-- Save (create or replace) a template with its items in one step
-- p_items: [{exerciseId, deviceTypeId?, sets, warmupSets, repMin?, repMax?, durationSeconds?, note?}]
-- ---------------------------------------------------------------------------
create function public.save_template(
  p_template_id uuid,
  p_name text,
  p_training_type_id uuid,
  p_focus_id uuid,
  p_note text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := coalesce(p_template_id, gen_random_uuid());
  v_item jsonb;
  v_position integer := 0;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'template_needs_exercises' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.training_types t
     where t.id = p_training_type_id and (t.owner_id is null or t.owner_id = (select auth.uid()))
  ) then
    raise exception 'invalid_training_type' using errcode = 'P0001';
  end if;

  if p_template_id is null then
    insert into public.workout_templates (id, user_id, training_type_id, focus_id, name, note)
    values (v_id, (select auth.uid()), p_training_type_id, p_focus_id, btrim(p_name),
            nullif(btrim(coalesce(p_note, '')), ''));
  else
    update public.workout_templates
       set training_type_id = p_training_type_id, focus_id = p_focus_id, name = btrim(p_name),
           note = nullif(btrim(coalesce(p_note, '')), '')
     where id = p_template_id and user_id = (select auth.uid());
    if not found then
      raise exception 'not_template_owner' using errcode = '42501';
    end if;
    delete from public.workout_template_items where template_id = p_template_id;
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.workout_template_items (
      template_id, position, exercise_id, device_type_id, sets, warmup_sets,
      rep_min, rep_max, duration_seconds, note
    ) values (
      v_id, v_position, (v_item ->> 'exerciseId')::uuid,
      nullif(v_item ->> 'deviceTypeId', '')::uuid,
      coalesce((v_item ->> 'sets')::integer, 3),
      coalesce((v_item ->> 'warmupSets')::integer, 0),
      (v_item ->> 'repMin')::integer, (v_item ->> 'repMax')::integer,
      (v_item ->> 'durationSeconds')::integer,
      nullif(btrim(coalesce(v_item ->> 'note', '')), '')
    );
    v_position := v_position + 1;
  end loop;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- A template from one of my finished workouts (new, or replacing the items of one of
-- mine). Sets = ticked working sets, warm-ups counted, rep range = the reps done.
-- ---------------------------------------------------------------------------
create function public.template_from_workout(
  p_workout_id uuid,
  p_name text,
  p_template_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workout public.workouts%rowtype;
  v_items jsonb;
  v_name text;
begin
  select * into v_workout from public.workouts w
   where w.id = p_workout_id and w.user_id = (select auth.uid());
  if not found then
    raise exception 'not_workout_owner' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(item order by position), '[]'::jsonb) into v_items
    from (
      select i.position,
             jsonb_build_object(
               'exerciseId', i.exercise_id,
               'deviceTypeId', d.device_type_id,
               'sets', greatest(1, count(*) filter (where not s.is_warmup)),
               'warmupSets', least(5, count(*) filter (where s.is_warmup)),
               'repMin', min(s.reps) filter (where not s.is_warmup and s.reps > 0),
               'repMax', max(s.reps) filter (where not s.is_warmup and s.reps > 0),
               'durationSeconds', max(s.duration_seconds) filter (where not s.is_warmup),
               'note', i.note
             ) as item
        from public.workout_items i
        left join public.devices d on d.id = i.device_id
        join public.workout_sets s on s.item_id = i.id and s.completed_at is not null
       where i.workout_id = p_workout_id
       group by i.id, i.position, i.exercise_id, d.device_type_id, i.note
    ) per_item;

  if p_template_id is not null then
    select t.name into v_name from public.workout_templates t
     where t.id = p_template_id and t.user_id = (select auth.uid());
    if not found then
      raise exception 'not_template_owner' using errcode = '42501';
    end if;
    return public.save_template(
      p_template_id, v_name, v_workout.training_type_id,
      (select focus_id from public.workout_templates where id = p_template_id),
      (select note from public.workout_templates where id = p_template_id), v_items);
  end if;
  return public.save_template(null, p_name, v_workout.training_type_id, v_workout.focus_id,
                              null, v_items);
end;
$$;

-- ---------------------------------------------------------------------------
-- Copy a template I may see into my own
-- ---------------------------------------------------------------------------
create function public.copy_template(p_template_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_template public.workout_templates%rowtype;
  v_items jsonb;
begin
  select * into v_template from public.workout_templates t where t.id = p_template_id;
  if not found or not private.can_view_user_data(v_template.user_id, 'training') then
    raise exception 'template_not_visible' using errcode = '42501';
  end if;
  select jsonb_agg(jsonb_build_object(
           'exerciseId', i.exercise_id, 'deviceTypeId', i.device_type_id, 'sets', i.sets,
           'warmupSets', i.warmup_sets, 'repMin', i.rep_min, 'repMax', i.rep_max,
           'durationSeconds', i.duration_seconds, 'note', i.note) order by i.position)
    into v_items
    from public.workout_template_items i where i.template_id = p_template_id;
  return public.save_template(
    null, v_template.name,
    -- A personal training type of someone else becomes the matching default (or Studio).
    coalesce(
      (select t.id from public.training_types t
        where t.id = v_template.training_type_id
          and (t.owner_id is null or t.owner_id = (select auth.uid()))),
      (select t.id from public.training_types t
        where t.owner_id is null and t.kind = 'exercises' order by t.sort limit 1)),
    v_template.focus_id, v_template.note, v_items);
end;
$$;

-- ---------------------------------------------------------------------------
-- Templates I can use: mine and those of others I may see, with when I last used each,
-- when its owner last used it, and how many exercises it has.
-- ---------------------------------------------------------------------------
create function public.template_overview()
returns table (
  id uuid,
  user_id uuid,
  owner_name text,
  name text,
  training_type_id uuid,
  focus_id uuid,
  note text,
  archived_at timestamptz,
  exercise_count integer,
  my_last_used_at timestamptz,
  owner_last_used_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.id, t.user_id, p.display_name, t.name, t.training_type_id, t.focus_id, t.note,
         t.archived_at,
         (select count(*)::integer from public.workout_template_items i where i.template_id = t.id),
         (select max(w.started_at) from public.workouts w
           where w.template_id = t.id and w.user_id = (select auth.uid())),
         (select max(w.started_at) from public.workouts w
           where w.template_id = t.id and w.user_id = t.user_id)
    from public.workout_templates t
    left join public.profiles p on p.id = t.user_id;
$$;

-- ---------------------------------------------------------------------------
-- start_workout with an optional template: its exercises in order, the device of each
-- type at the place, warm-up and working sets ready (values come from history in the app).
-- ---------------------------------------------------------------------------
drop function public.start_workout(uuid, uuid);
create function public.start_workout(
  p_training_type_id uuid,
  p_location_id uuid default null,
  p_template_id uuid default null
)
returns public.workouts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type public.training_types%rowtype;
  v_location uuid := p_location_id;
  v_workout public.workouts%rowtype;
  v_template public.workout_templates%rowtype;
  v_item record;
  v_item_id uuid;
  v_n integer;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into v_type from public.training_types t
   where t.id = p_training_type_id
     and t.archived_at is null
     and (t.owner_id is null or t.owner_id = auth.uid());
  if not found then
    raise exception 'invalid_training_type' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.workouts where user_id = auth.uid() and status = 'active') then
    raise exception 'workout_already_active' using errcode = 'P0001';
  end if;
  if p_template_id is not null then
    select * into v_template from public.workout_templates t where t.id = p_template_id;
    if not found or not private.can_view_user_data(v_template.user_id, 'training') then
      raise exception 'template_not_visible' using errcode = '42501';
    end if;
  end if;

  if v_location is null and v_type.location_mode = 'home_studio' then
    select tp.home_location_id into v_location
      from public.training_prefs tp where tp.user_id = auth.uid();
  elsif v_location is null and v_type.location_mode = 'private' then
    select l.id into v_location from public.locations l
     where l.owner_id = auth.uid() order by l.created_at limit 1;
    if v_location is null then
      insert into public.locations (name, owner_id, created_by)
      values (v_type.name, auth.uid(), auth.uid())
      returning id into v_location;
    end if;
  end if;
  if v_location is not null and not private.can_view_location(v_location) then
    v_location := null;
  end if;

  insert into public.workouts (user_id, training_type_id, location_id, template_id, focus_id)
  values (auth.uid(), p_training_type_id, v_location, p_template_id, v_template.focus_id)
  returning * into v_workout;

  if p_template_id is not null then
    for v_item in
      select i.* from public.workout_template_items i
       where i.template_id = p_template_id order by i.position
    loop
      insert into public.workout_items (workout_id, exercise_id, device_id, position, note)
      values (
        v_workout.id, v_item.exercise_id,
        (select d.id from public.devices d
          where d.location_id = v_location and d.device_type_id = v_item.device_type_id),
        v_item.position, v_item.note)
      returning id into v_item_id;
      for v_n in 0 .. v_item.warmup_sets + v_item.sets - 1 loop
        insert into public.workout_sets (item_id, position, is_warmup)
        values (v_item_id, v_n, v_n < v_item.warmup_sets);
      end loop;
    end loop;
  end if;
  return v_workout;
end;
$$;

revoke all on all functions in schema private from public;
grant execute on function private.template_owner(uuid) to authenticated;
revoke all on function public.start_workout(uuid, uuid, uuid) from public, anon;
revoke all on function public.save_template(uuid, text, uuid, uuid, text, jsonb) from public, anon;
revoke all on function public.template_from_workout(uuid, text, uuid) from public, anon;
revoke all on function public.copy_template(uuid) from public, anon;
revoke all on function public.template_overview() from public, anon;
grant execute on function public.start_workout(uuid, uuid, uuid) to authenticated;
grant execute on function public.save_template(uuid, text, uuid, uuid, text, jsonb) to authenticated;
grant execute on function public.template_from_workout(uuid, text, uuid) to authenticated;
grant execute on function public.copy_template(uuid) to authenticated;
grant execute on function public.template_overview() to authenticated;
