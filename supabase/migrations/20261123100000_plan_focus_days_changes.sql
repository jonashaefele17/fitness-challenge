-- Baustein 5a, feedback: plans carry a focus and a list of templates (several: pick one at
-- the start, so a "Push" day need not always be the same workout). A weekly series can set
-- focus and templates per weekday (Mo = Push, Do = Pull). A single date can be changed on its
-- own ("Nur diesen Termin ändern": move it, other time, focus or templates).
-- Training module, personal: visibility only through private.can_view_user_data.

-- Templates of a plan: all must be ones I may use.
create function private.templates_usable(p_template_ids uuid[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from unnest(coalesce(p_template_ids, '{}')) as x(id)
     where not exists (
       select 1 from public.workout_templates wt
        where wt.id = x.id and private.can_view_user_data(wt.user_id, 'training')));
$$;

alter table public.plans
  add column focus_id uuid references public.training_focuses (id) on delete set null,
  add column template_ids uuid[] not null default '{}';
update public.plans set template_ids = array[template_id] where template_id is not null;

drop policy "plans: own, with a type and template I may use" on public.plans;
drop policy "plans: owner edits" on public.plans;
alter table public.plans drop column template_id;

create policy "plans: own, with a type and templates I may use" on public.plans
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (training_type_id is null or exists (
      select 1 from public.training_types t
       where t.id = training_type_id
         and (t.owner_id is null or t.owner_id = (select auth.uid()))))
    and private.templates_usable(template_ids)
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
    and private.templates_usable(template_ids)
  );

-- Per weekday of a series: its own focus and templates (else the plan's).
create table public.plan_days (
  plan_id uuid not null references public.plans (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  focus_id uuid references public.training_focuses (id) on delete set null,
  template_ids uuid[] not null default '{}',
  primary key (plan_id, weekday)
);

-- One date changed on its own; null fields stay as planned.
create table public.plan_changes (
  plan_id uuid not null references public.plans (id) on delete cascade,
  -- The date as planned (key for cancel/done too).
  on_date date not null,
  moved_to date,
  start_time time,
  -- true: the date has no fixed time any more (start_time null then means "none").
  clear_time boolean not null default false,
  focus_id uuid references public.training_focuses (id) on delete set null,
  template_ids uuid[],
  primary key (plan_id, on_date)
);

alter table public.plan_days enable row level security;
alter table public.plan_changes enable row level security;
revoke all on public.plan_days, public.plan_changes from anon, authenticated;
grant select, insert, update, delete on public.plan_days, public.plan_changes to authenticated;

create policy "plan_days: like their plan" on public.plan_days
  for select to authenticated
  using (exists (
    select 1 from public.plans p where p.id = plan_id
      and (p.user_id = (select auth.uid()) or private.can_view_user_data(p.user_id, 'training'))));
create policy "plan_days: owner adds" on public.plan_days
  for insert to authenticated
  with check (
    exists (select 1 from public.plans p where p.id = plan_id and p.user_id = (select auth.uid()))
    and private.templates_usable(template_ids));
create policy "plan_days: owner changes" on public.plan_days
  for update to authenticated
  using (exists (select 1 from public.plans p where p.id = plan_id and p.user_id = (select auth.uid())))
  with check (private.templates_usable(template_ids));
create policy "plan_days: owner removes" on public.plan_days
  for delete to authenticated
  using (exists (select 1 from public.plans p where p.id = plan_id and p.user_id = (select auth.uid())));

create policy "plan_changes: like their plan" on public.plan_changes
  for select to authenticated
  using (exists (
    select 1 from public.plans p where p.id = plan_id
      and (p.user_id = (select auth.uid()) or private.can_view_user_data(p.user_id, 'training'))));
create policy "plan_changes: owner adds" on public.plan_changes
  for insert to authenticated
  with check (
    exists (select 1 from public.plans p where p.id = plan_id and p.user_id = (select auth.uid()))
    and private.templates_usable(template_ids));
create policy "plan_changes: owner changes" on public.plan_changes
  for update to authenticated
  using (exists (select 1 from public.plans p where p.id = plan_id and p.user_id = (select auth.uid())))
  with check (private.templates_usable(template_ids));
create policy "plan_changes: owner removes" on public.plan_changes
  for delete to authenticated
  using (exists (select 1 from public.plans p where p.id = plan_id and p.user_id = (select auth.uid())));

-- ---------------------------------------------------------------------------
-- Occurrences with focus, templates and single-date changes. on_date is where the date
-- shows (moved or not), plan_date the date as planned (key for cancel, change, done).
-- Dates moved by up to 60 days into or out of the range are included.
-- ---------------------------------------------------------------------------
drop function public.plan_occurrences(uuid, date, date);
create function public.plan_occurrences(p_user_id uuid, p_from date, p_to date)
returns table (
  plan_id uuid,
  user_id uuid,
  on_date date,
  plan_date date,
  start_time time,
  kind text,
  training_type_id uuid,
  type_name text,
  type_icon text,
  focus_id uuid,
  focus_name text,
  focus_short text,
  template_ids uuid[],
  title text,
  note text,
  recurring boolean,
  changed boolean,
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
    select v.id, v.starts_on as plan_date from visible v
     where cardinality(v.repeat_weekdays) = 0
       and v.starts_on between p_from - 60 and p_to + 60
    union all
    select v.id, d::date from visible v,
      generate_series(greatest(v.starts_on, p_from - 60),
                      least(coalesce(v.repeat_until, p_to + 60), p_to + 60), interval '1 day') d
     where cardinality(v.repeat_weekdays) > 0
       and extract(isodow from d)::smallint = any (v.repeat_weekdays)
  ),
  resolved as (
    select v.id as plan_id, v.user_id,
           coalesce(c.moved_to, d.plan_date) as on_date, d.plan_date,
           case when c.clear_time then null else coalesce(c.start_time, v.start_time) end as start_time,
           v.kind, v.training_type_id,
           coalesce(c.focus_id, pd.focus_id, v.focus_id) as focus_id,
           coalesce(c.template_ids, case when pd.plan_id is not null then pd.template_ids end,
                    v.template_ids) as template_ids,
           v.title, v.note, cardinality(v.repeat_weekdays) > 0 as recurring,
           c.plan_id is not null as changed
      from dates d
      join visible v on v.id = d.id
      left join public.plan_days pd
        on pd.plan_id = v.id and pd.weekday = extract(isodow from d.plan_date)::smallint
      left join public.plan_changes c on c.plan_id = v.id and c.on_date = d.plan_date
  )
  select r.plan_id, r.user_id, r.on_date, r.plan_date, r.start_time, r.kind, r.training_type_id,
         t.name, t.icon, r.focus_id, f.name, f.short_name, r.template_ids, r.title, r.note,
         r.recurring, r.changed,
         case
           when w.id is not null then 'done'
           when s.plan_id is not null then 'cancelled'
           else 'planned'
         end,
         w.id
    from resolved r
    left join public.training_types t on t.id = r.training_type_id
    left join public.training_focuses f on f.id = r.focus_id
    left join public.plan_skips s on s.plan_id = r.plan_id and s.on_date = r.plan_date
    left join lateral (
      select wo.id from public.workouts wo
       where wo.plan_id = r.plan_id and wo.plan_on = r.plan_date and wo.status = 'finished'
       limit 1
    ) w on true
   where r.on_date between p_from and p_to
   order by r.on_date, r.start_time nulls last;
$$;

revoke all on function public.plan_occurrences(uuid, date, date) from public, anon;
grant execute on function public.plan_occurrences(uuid, date, date) to authenticated;
