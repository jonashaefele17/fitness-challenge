-- Baustein 5b: invitations to plans (social module "invitations").
--
-- A plan (training module) can have participants from one of its owner's groups. An
-- invitation holds for the whole plan (a series included); a participant answers for the
-- whole plan or for a single date, and can propose another time for a date. "Ich komm mit":
-- someone asks to join, the owner answers. Changes by the owner put everyone back to
-- "invited". Every step notifies through the "appointments" category ("Termine").
-- Writes only through the functions below; the training module knows nothing of this.

-- ---------------------------------------------------------------------------
-- Plans as notification targets (training objects, visible within a shared group)
-- ---------------------------------------------------------------------------
create function private.plan_visible(p_target_id uuid, p_group_id uuid, p_viewer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.plans p
     where p.id = p_target_id and private.is_member(p_group_id, p.user_id)
  ) and private.is_member(p_group_id, p_viewer_id);
$$;

create function private.plan_owner(p_target_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.user_id from public.plans p where p.id = p_target_id;
$$;

insert into public.target_types (key, module, can_view_fn, owner_fn) values
  ('plan', 'training', 'private.plan_visible', 'private.plan_owner');

-- "Studio · Push · 25.11. 18:00" for bell and push.
create function private.plan_preview(p_plan_id uuid, p_on_date date)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select concat_ws(' · ',
           case when p.kind = 'event' then p.title else t.name end,
           f.name,
           to_char(coalesce(c.moved_to, p_on_date, p.starts_on), 'DD.MM.')
             || coalesce(' ' || to_char(coalesce(c.start_time, p.start_time), 'HH24:MI'), ''))
    from public.plans p
    left join public.training_types t on t.id = p.training_type_id
    left join public.training_focuses f on f.id = p.focus_id
    left join public.plan_changes c on c.plan_id = p.id and c.on_date = p_on_date
   where p.id = p_plan_id;
$$;

-- ---------------------------------------------------------------------------
-- Participants and their answers
-- ---------------------------------------------------------------------------
create table public.plan_participants (
  plan_id uuid not null references public.plans (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- The group the invitation lives in (owner and participant are members).
  group_id uuid not null references public.groups (id) on delete cascade,
  -- invited | accepted | maybe | declined | requested ("Ich komm mit", not answered yet)
  status text not null default 'invited'
    check (status in ('invited', 'accepted', 'maybe', 'declined', 'requested')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (plan_id, user_id)
);
create index plan_participants_user_idx on public.plan_participants (user_id);

-- An answer for one date of the plan (overrides the answer for the whole plan), or a
-- proposal of another time for that date.
create table public.plan_responses (
  plan_id uuid not null references public.plans (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- The date as planned (plan_date of the occurrence).
  on_date date not null,
  status text not null check (status in ('accepted', 'maybe', 'declined', 'proposed')),
  proposed_date date,
  proposed_time time,
  created_at timestamptz not null default now(),
  primary key (plan_id, user_id, on_date),
  constraint plan_responses_proposal check ((status = 'proposed') = (proposed_date is not null))
);

alter table public.plan_participants enable row level security;
alter table public.plan_responses enable row level security;
revoke all on public.plan_participants, public.plan_responses from anon, authenticated;
grant select on public.plan_participants, public.plan_responses to authenticated;

create policy "plan_participants: group members read" on public.plan_participants
  for select to authenticated using (private.is_group_member(group_id));
create policy "plan_responses: group members read" on public.plan_responses
  for select to authenticated
  using (exists (
    select 1 from public.plan_participants pp
     where pp.plan_id = plan_responses.plan_id and pp.user_id = plan_responses.user_id
       and private.is_group_member(pp.group_id)));

-- Notify people about a plan (actor = the current user).
create function private.notify_plan(
  p_recipients uuid[],
  p_group_id uuid,
  p_plan_id uuid,
  p_on_date date,
  p_event text,
  p_extra jsonb default '{}'
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications
    (recipient_id, group_id, category, event, actor_id, target_type, target_id, data)
  select r, p_group_id, 'appointments', p_event, (select auth.uid()), 'plan', p_plan_id,
         jsonb_build_object('preview', private.plan_preview(p_plan_id, p_on_date),
                            'date', p_on_date) || p_extra
    from unnest(p_recipients) r
   where r is distinct from (select auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- The owner sets who is invited (adds invite, removed people are dropped)
-- ---------------------------------------------------------------------------
create function public.set_plan_participants(p_plan_id uuid, p_group_id uuid, p_user_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.plans%rowtype;
  v_new uuid[];
begin
  select * into v_plan from public.plans p where p.id = p_plan_id and p.user_id = auth.uid();
  if not found then
    raise exception 'not_plan_owner' using errcode = '42501';
  end if;
  if not private.is_member(p_group_id, auth.uid()) or exists (
    select 1 from unnest(p_user_ids) u where not private.is_member(p_group_id, u) or u = auth.uid()
  ) then
    raise exception 'not_in_group' using errcode = 'P0001';
  end if;

  delete from public.plan_participants pp
   where pp.plan_id = p_plan_id and pp.status <> 'requested'
     and not (pp.user_id = any (p_user_ids));

  select coalesce(array_agg(u), '{}') into v_new from unnest(p_user_ids) u
   where not exists (
     select 1 from public.plan_participants pp where pp.plan_id = p_plan_id and pp.user_id = u);
  insert into public.plan_participants (plan_id, user_id, group_id)
  select p_plan_id, u, p_group_id from unnest(v_new) u;
  -- Someone asked to join and is now invited: that is a yes.
  update public.plan_participants set status = 'accepted', responded_at = now()
   where plan_id = p_plan_id and status = 'requested' and user_id = any (p_user_ids);

  perform private.notify_plan(v_new, p_group_id, p_plan_id, v_plan.starts_on, 'plan_invite');
end;
$$;

-- ---------------------------------------------------------------------------
-- A participant answers: for the whole plan (p_on_date null) or one date; "proposed" with
-- another day and time for that date.
-- ---------------------------------------------------------------------------
create function public.respond_to_plan(
  p_plan_id uuid,
  p_on_date date,
  p_status text,
  p_proposed_date date default null,
  p_proposed_time time default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_part public.plan_participants%rowtype;
  v_owner uuid;
begin
  select * into v_part from public.plan_participants pp
   where pp.plan_id = p_plan_id and pp.user_id = auth.uid() and pp.status <> 'requested';
  if not found then
    raise exception 'not_invited' using errcode = '42501';
  end if;
  if p_status not in ('accepted', 'maybe', 'declined', 'proposed')
     or (p_status = 'proposed' and (p_on_date is null or p_proposed_date is null)) then
    raise exception 'invalid_answer' using errcode = 'P0001';
  end if;

  if p_on_date is null then
    update public.plan_participants set status = p_status, responded_at = now()
     where plan_id = p_plan_id and user_id = auth.uid();
    delete from public.plan_responses where plan_id = p_plan_id and user_id = auth.uid();
  else
    insert into public.plan_responses (plan_id, user_id, on_date, status, proposed_date, proposed_time)
    values (p_plan_id, auth.uid(), p_on_date, p_status,
            case when p_status = 'proposed' then p_proposed_date end,
            case when p_status = 'proposed' then p_proposed_time end)
    on conflict (plan_id, user_id, on_date) do update
      set status = excluded.status, proposed_date = excluded.proposed_date,
          proposed_time = excluded.proposed_time, created_at = now();
  end if;

  select p.user_id into v_owner from public.plans p where p.id = p_plan_id;
  perform private.notify_plan(array[v_owner], v_part.group_id, p_plan_id,
    coalesce(p_on_date, (select starts_on from public.plans where id = p_plan_id)),
    -- plan_accepted | plan_maybe | plan_declined | plan_proposed
    'plan_' || p_status);
end;
$$;

-- The owner takes a proposal: that date moves (a single plan moves as a whole).
create function public.accept_plan_proposal(p_plan_id uuid, p_user_id uuid, p_on_date date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.plans%rowtype;
  v_resp public.plan_responses%rowtype;
begin
  select * into v_plan from public.plans p where p.id = p_plan_id and p.user_id = auth.uid();
  if not found then
    raise exception 'not_plan_owner' using errcode = '42501';
  end if;
  select * into v_resp from public.plan_responses r
   where r.plan_id = p_plan_id and r.user_id = p_user_id and r.on_date = p_on_date
     and r.status = 'proposed';
  if not found then
    raise exception 'no_proposal' using errcode = 'P0001';
  end if;

  if cardinality(v_plan.repeat_weekdays) = 0 then
    update public.plans
       set starts_on = v_resp.proposed_date,
           start_time = coalesce(v_resp.proposed_time, start_time)
     where id = p_plan_id;
  else
    insert into public.plan_changes (plan_id, on_date, moved_to, start_time)
    values (p_plan_id, p_on_date, nullif(v_resp.proposed_date, p_on_date), v_resp.proposed_time)
    on conflict (plan_id, on_date) do update
      set moved_to = excluded.moved_to,
          start_time = coalesce(excluded.start_time, public.plan_changes.start_time),
          clear_time = false;
  end if;
  -- The proposer has said yes to the new time (the change reset the others).
  if cardinality(v_plan.repeat_weekdays) = 0 then
    delete from public.plan_responses where plan_id = p_plan_id and user_id = p_user_id;
    update public.plan_participants set status = 'accepted', responded_at = now()
     where plan_id = p_plan_id and user_id = p_user_id;
  else
    update public.plan_responses
       set status = 'accepted', proposed_date = null, proposed_time = null
     where plan_id = p_plan_id and user_id = p_user_id and on_date = p_on_date;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- "Ich komm mit": ask to join someone's plan; the owner answers
-- ---------------------------------------------------------------------------
create function public.request_to_join_plan(p_plan_id uuid, p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select p.user_id into v_owner from public.plans p where p.id = p_plan_id;
  if v_owner is null or v_owner = auth.uid()
     or not private.is_member(p_group_id, auth.uid()) or not private.is_member(p_group_id, v_owner) then
    raise exception 'cannot_join' using errcode = 'P0001';
  end if;
  insert into public.plan_participants (plan_id, user_id, group_id, status)
  values (p_plan_id, auth.uid(), p_group_id, 'requested')
  on conflict (plan_id, user_id) do nothing;
  perform private.notify_plan(array[v_owner], p_group_id, p_plan_id,
    (select starts_on from public.plans where id = p_plan_id), 'plan_request');
end;
$$;

create function public.answer_join_request(p_plan_id uuid, p_user_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group uuid;
begin
  if not exists (select 1 from public.plans p where p.id = p_plan_id and p.user_id = auth.uid()) then
    raise exception 'not_plan_owner' using errcode = '42501';
  end if;
  select pp.group_id into v_group from public.plan_participants pp
   where pp.plan_id = p_plan_id and pp.user_id = p_user_id and pp.status = 'requested';
  if not found then
    raise exception 'no_request' using errcode = 'P0001';
  end if;
  if p_accept then
    update public.plan_participants set status = 'accepted', responded_at = now()
     where plan_id = p_plan_id and user_id = p_user_id;
  else
    delete from public.plan_participants where plan_id = p_plan_id and user_id = p_user_id;
  end if;
  perform private.notify_plan(array[p_user_id], v_group, p_plan_id,
    (select starts_on from public.plans where id = p_plan_id),
    case when p_accept then 'plan_request_accepted' else 'plan_request_declined' end);
end;
$$;

-- ---------------------------------------------------------------------------
-- Changes by the owner: everyone confirms again; cancellations are told
-- ---------------------------------------------------------------------------
create function private.on_plan_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group uuid;
  v_people uuid[];
begin
  if new.starts_on is not distinct from old.starts_on
     and new.start_time is not distinct from old.start_time
     and new.repeat_weekdays is not distinct from old.repeat_weekdays
     and new.repeat_until is not distinct from old.repeat_until
     and new.focus_id is not distinct from old.focus_id
     and new.template_ids is not distinct from old.template_ids
     and new.training_type_id is not distinct from old.training_type_id
     and new.title is not distinct from old.title then
    return new;
  end if;
  select min(pp.group_id::text)::uuid, array_agg(pp.user_id) into v_group, v_people
    from public.plan_participants pp where pp.plan_id = new.id and pp.status <> 'requested';
  if v_group is null then
    return new;
  end if;
  update public.plan_participants set status = 'invited', responded_at = null
   where plan_id = new.id and status <> 'requested';
  delete from public.plan_responses where plan_id = new.id and status <> 'proposed';
  perform private.notify_plan(v_people, v_group, new.id, new.starts_on, 'plan_changed');
  return new;
end;
$$;

create trigger plans_after_change_invitations
  after update on public.plans
  for each row execute function private.on_plan_changed();

-- One date changed (moved, other time …): that date is open again for everyone.
create function private.on_plan_date_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group uuid;
  v_people uuid[];
begin
  select min(pp.group_id::text)::uuid, array_agg(pp.user_id) into v_group, v_people
    from public.plan_participants pp where pp.plan_id = new.plan_id and pp.status <> 'requested';
  if v_group is null then
    return new;
  end if;
  delete from public.plan_responses
   where plan_id = new.plan_id and on_date = new.on_date and status <> 'proposed'
     and user_id <> coalesce((
       select r.user_id from public.plan_responses r
        where r.plan_id = new.plan_id and r.on_date = new.on_date and r.status = 'proposed'
          and r.proposed_date = coalesce(new.moved_to, new.on_date) limit 1), '00000000-0000-0000-0000-000000000000');
  perform private.notify_plan(v_people, v_group, new.plan_id, new.on_date, 'plan_changed');
  return new;
end;
$$;

create trigger plan_changes_after_write_invitations
  after insert or update on public.plan_changes
  for each row execute function private.on_plan_date_changed();

create function private.on_plan_date_cancelled()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group uuid;
  v_people uuid[];
begin
  select min(pp.group_id::text)::uuid, array_agg(pp.user_id) into v_group, v_people
    from public.plan_participants pp where pp.plan_id = new.plan_id and pp.status <> 'requested';
  if v_group is not null then
    perform private.notify_plan(v_people, v_group, new.plan_id, new.on_date, 'plan_cancelled');
  end if;
  return new;
end;
$$;

create trigger plan_skips_after_insert_invitations
  after insert on public.plan_skips
  for each row execute function private.on_plan_date_cancelled();

-- A deleted plan: tell the participants before it goes (their rows go with it).
create function private.on_plan_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group uuid;
  v_people uuid[];
begin
  select min(pp.group_id::text)::uuid, array_agg(pp.user_id) into v_group, v_people
    from public.plan_participants pp where pp.plan_id = old.id and pp.status <> 'requested';
  if v_group is not null then
    insert into public.notifications
      (recipient_id, group_id, category, event, actor_id, target_type, target_id, data)
    select r, v_group, 'appointments', 'plan_cancelled', (select auth.uid()), 'plan', old.id,
           jsonb_build_object('preview', private.plan_preview(old.id, old.starts_on),
                              'date', old.starts_on, 'deleted', true)
      from unnest(v_people) r
     where r is distinct from (select auth.uid());
  end if;
  return old;
end;
$$;

create trigger plans_before_delete_invitations
  before delete on public.plans
  for each row execute function private.on_plan_deleted();

-- ---------------------------------------------------------------------------
-- Plans I take part in (someone else's), for my calendar; and who takes part in plans.
-- ---------------------------------------------------------------------------
create function public.my_joined_plans()
returns table (plan_id uuid, owner_id uuid, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select pp.plan_id, p.user_id, pp.status
    from public.plan_participants pp
    join public.plans p on p.id = pp.plan_id
   where pp.user_id = (select auth.uid()) and pp.status in ('invited', 'accepted', 'maybe');
$$;

revoke all on function public.set_plan_participants(uuid, uuid, uuid[]) from public, anon;
revoke all on function public.respond_to_plan(uuid, date, text, date, time) from public, anon;
revoke all on function public.accept_plan_proposal(uuid, uuid, date) from public, anon;
revoke all on function public.request_to_join_plan(uuid, uuid) from public, anon;
revoke all on function public.answer_join_request(uuid, uuid, boolean) from public, anon;
revoke all on function public.my_joined_plans() from public, anon;
grant execute on function public.set_plan_participants(uuid, uuid, uuid[]) to authenticated;
grant execute on function public.respond_to_plan(uuid, date, text, date, time) to authenticated;
grant execute on function public.accept_plan_proposal(uuid, uuid, date) to authenticated;
grant execute on function public.request_to_join_plan(uuid, uuid) to authenticated;
grant execute on function public.answer_join_request(uuid, uuid, boolean) to authenticated;
grant execute on function public.my_joined_plans() to authenticated;

-- Answers live: participants change, answers arrive.
alter publication supabase_realtime add table public.plan_participants, public.plan_responses;
