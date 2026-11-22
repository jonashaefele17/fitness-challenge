-- Baustein 5a: planning (training module, personal). A plan is a training or an event on a
-- day, optionally at a time, optionally weekly on chosen weekdays (until a date or open
-- ended). Single dates of a series can be cancelled; a workout started from a plan is linked
-- to it, which marks that date as done. Occurrences are computed, not stored.
-- Visibility for others only through private.can_view_user_data (no social tables here).

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('training', 'event')),
  training_type_id uuid references public.training_types (id),
  template_id uuid references public.workout_templates (id) on delete set null,
  -- Event name (required for events), optional label for trainings.
  title text check (title is null or char_length(btrim(title)) between 1 and 60),
  note text check (note is null or char_length(note) <= 500),
  starts_on date not null,
  start_time time,
  -- ISO weekdays (1 = Monday … 7 = Sunday); empty: once, on starts_on.
  repeat_weekdays smallint[] not null default '{}'
    check (repeat_weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  repeat_until date check (repeat_until is null or repeat_until >= starts_on),
  created_at timestamptz not null default now(),
  constraint plans_kind_fields check (
    (kind = 'training' and training_type_id is not null)
    or (kind = 'event' and title is not null)
  )
);
create index plans_user_idx on public.plans (user_id, starts_on);

-- A single date of a plan that does not take place ("Ausfall").
create table public.plan_skips (
  plan_id uuid not null references public.plans (id) on delete cascade,
  on_date date not null,
  created_at timestamptz not null default now(),
  primary key (plan_id, on_date)
);

alter table public.workouts
  add column plan_id uuid references public.plans (id) on delete set null,
  add column plan_on date;
create index workouts_plan_idx on public.workouts (plan_id, plan_on) where plan_id is not null;

alter table public.plans enable row level security;
alter table public.plan_skips enable row level security;
revoke all on public.plans, public.plan_skips from anon, authenticated;
grant select, insert, update, delete on public.plans to authenticated;
grant select, insert, delete on public.plan_skips to authenticated;

create policy "plans: owner and those who may see their training" on public.plans
  for select to authenticated
  using (user_id = (select auth.uid()) or private.can_view_user_data(user_id, 'training'));
create policy "plans: own, with a type and template I may use" on public.plans
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (training_type_id is null or exists (
      select 1 from public.training_types t
       where t.id = training_type_id
         and (t.owner_id is null or t.owner_id = (select auth.uid()))))
    and (template_id is null or exists (
      select 1 from public.workout_templates wt
       where wt.id = template_id and private.can_view_user_data(wt.user_id, 'training')))
  );
create policy "plans: owner edits" on public.plans
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (training_type_id is null or exists (
      select 1 from public.training_types t
       where t.id = training_type_id
         and (t.owner_id is null or t.owner_id = (select auth.uid()))))
    and (template_id is null or exists (
      select 1 from public.workout_templates wt
       where wt.id = template_id and private.can_view_user_data(wt.user_id, 'training')))
  );
create policy "plans: owner deletes" on public.plans
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "plan_skips: like their plan" on public.plan_skips
  for select to authenticated
  using (exists (
    select 1 from public.plans p where p.id = plan_id
      and (p.user_id = (select auth.uid()) or private.can_view_user_data(p.user_id, 'training'))));
create policy "plan_skips: owner" on public.plan_skips
  for insert to authenticated
  with check (exists (select 1 from public.plans p where p.id = plan_id and p.user_id = (select auth.uid())));
create policy "plan_skips: owner removes" on public.plan_skips
  for delete to authenticated
  using (exists (select 1 from public.plans p where p.id = plan_id and p.user_id = (select auth.uid())));

-- ---------------------------------------------------------------------------
-- Occurrences of a person's plans in a date range (max. ~1 year), with their state:
-- planned, cancelled (skipped) or done (a finished workout started from it).
-- ---------------------------------------------------------------------------
create function public.plan_occurrences(p_user_id uuid, p_from date, p_to date)
returns table (
  plan_id uuid,
  user_id uuid,
  on_date date,
  start_time time,
  kind text,
  training_type_id uuid,
  type_name text,
  type_icon text,
  template_id uuid,
  title text,
  note text,
  recurring boolean,
  status text,
  workout_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  with visible as (
    select p.* from public.plans p
     where p.user_id = p_user_id
       and private.can_view_user_data(p_user_id, 'training')
       and p_to >= p_from and p_to - p_from <= 400
  ),
  dates as (
    select v.id, v.starts_on as on_date from visible v
     where cardinality(v.repeat_weekdays) = 0 and v.starts_on between p_from and p_to
    union all
    select v.id, d::date from visible v,
      generate_series(greatest(v.starts_on, p_from),
                      least(coalesce(v.repeat_until, p_to), p_to), interval '1 day') d
     where cardinality(v.repeat_weekdays) > 0
       and extract(isodow from d)::smallint = any (v.repeat_weekdays)
  )
  select v.id, v.user_id, d.on_date, v.start_time, v.kind, v.training_type_id, t.name, t.icon,
         v.template_id,
         v.title, v.note, cardinality(v.repeat_weekdays) > 0,
         case
           when w.id is not null then 'done'
           when s.plan_id is not null then 'cancelled'
           else 'planned'
         end,
         w.id
    from dates d
    join visible v on v.id = d.id
    left join public.training_types t on t.id = v.training_type_id
    left join public.plan_skips s on s.plan_id = v.id and s.on_date = d.on_date
    left join lateral (
      select wo.id from public.workouts wo
       where wo.plan_id = v.id and wo.plan_on = d.on_date and wo.status = 'finished'
       limit 1
    ) w on true
   order by d.on_date, v.start_time nulls last;
$$;

revoke all on function public.plan_occurrences(uuid, date, date) from public, anon;
grant execute on function public.plan_occurrences(uuid, date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- start_workout: optionally from a plan (that date counts as done once finished)
-- ---------------------------------------------------------------------------
drop function public.start_workout(uuid, uuid, uuid);
create function public.start_workout(
  p_training_type_id uuid,
  p_location_id uuid default null,
  p_template_id uuid default null,
  p_plan_id uuid default null,
  p_plan_on date default null
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

  if p_plan_id is not null and not exists (
    select 1 from public.plans p where p.id = p_plan_id and p.user_id = auth.uid()
  ) then
    raise exception 'plan_not_found' using errcode = 'P0001';
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

  insert into public.workouts
    (user_id, training_type_id, location_id, template_id, focus_id, plan_id, plan_on)
  values (auth.uid(), p_training_type_id, v_location, p_template_id, v_template.focus_id,
          p_plan_id, case when p_plan_id is not null then coalesce(p_plan_on, current_date) end)
  returning * into v_workout;

  if p_template_id is not null then
    for v_item in
      select i.* from public.workout_template_items i
       where i.template_id = p_template_id order by i.position
    loop
      insert into public.workout_items (
        workout_id, exercise_id, device_id, position, note, rep_min, rep_max,
        target_seconds, rest_seconds, per_side, side_rest_seconds
      ) values (
        v_workout.id, v_item.exercise_id,
        (select d.id from public.devices d
          where d.location_id = v_location and d.device_type_id = v_item.device_type_id),
        v_item.position, v_item.note, v_item.rep_min, v_item.rep_max,
        v_item.duration_seconds, v_item.rest_seconds, v_item.per_side,
        v_item.side_rest_seconds)
      returning id into v_item_id;
      for v_n in 0 .. v_item.warmup_sets
                      + v_item.sets * (case when v_item.per_side then 2 else 1 end) - 1 loop
        insert into public.workout_sets (item_id, position, is_warmup)
        values (v_item_id, v_n, v_n < v_item.warmup_sets);
      end loop;
    end loop;
  end if;
  return v_workout;
end;
$$;

revoke all on function public.start_workout(uuid, uuid, uuid, uuid, date) from public, anon;
grant execute on function public.start_workout(uuid, uuid, uuid, uuid, date) to authenticated;
