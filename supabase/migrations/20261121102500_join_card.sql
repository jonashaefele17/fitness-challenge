-- Joining the group gets its own small card instead of sharing the person's day card
-- (it read as if the day's workout had been written into the join post).

alter table public.feed_days
  add column kind text not null default 'day' check (kind in ('day', 'joined'));
alter table public.feed_days drop constraint feed_days_group_id_actor_id_day_key;
alter table public.feed_days
  add constraint feed_days_card_unique unique (group_id, actor_id, day, kind);

create or replace function private.feed_events_assign_day()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.occurred_at := coalesce(new.occurred_at, new.created_at, now());
  insert into public.feed_days (group_id, actor_id, day, kind)
  values (new.group_id, new.actor_id, private.local_day(new.actor_id, new.occurred_at),
          case when new.type = 'member_joined' then 'joined' else 'day' end)
  on conflict (group_id, actor_id, day, kind) do update set day = excluded.day
  returning id into new.feed_day_id;
  return new;
end;
$$;

-- Move existing joins onto their own cards; drop day cards left empty.
insert into public.feed_days (group_id, actor_id, day, kind, created_at, last_activity_at)
select fe.group_id, fe.actor_id, fd.day, 'joined', fe.created_at, fe.last_activity_at
  from public.feed_events fe
  join public.feed_days fd on fd.id = fe.feed_day_id
 where fe.type = 'member_joined'
on conflict do nothing;
update public.feed_events fe
   set feed_day_id = j.id
  from public.feed_days old, public.feed_days j
 where fe.type = 'member_joined'
   and old.id = fe.feed_day_id
   and j.group_id = old.group_id and j.actor_id = old.actor_id and j.day = old.day
   and j.kind = 'joined';
delete from public.feed_days fd
 where fd.kind = 'day'
   and not exists (select 1 from public.feed_events fe where fe.feed_day_id = fd.id);

-- feed_cards returns the card kind too.
drop function public.feed_cards(uuid, text, integer, date, timestamptz, uuid);
create function public.feed_cards(
  p_group_id uuid,
  p_sort text default 'newest',
  p_limit integer default 15,
  p_before_day date default null,
  p_before_at timestamptz default null,
  p_before_id uuid default null
)
returns table (
  id uuid,
  actor_id uuid,
  day date,
  kind text,
  latest_at timestamptz,
  last_activity_at timestamptz,
  events jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  with cards as (
    select fd.id, fd.actor_id, fd.day, fd.kind, fd.last_activity_at,
           max(fe.occurred_at) as latest_at,
           jsonb_agg(jsonb_build_object(
             'id', fe.id, 'type', fe.type, 'targetType', fe.target_type,
             'targetId', fe.target_id, 'data', fe.data, 'occurredAt', fe.occurred_at,
             'createdAt', fe.created_at) order by fe.occurred_at) as events
      from public.feed_days fd
      join public.feed_events fe on fe.feed_day_id = fd.id
     where fd.group_id = p_group_id
     group by fd.id
  )
  select c.id, c.actor_id, c.day, c.kind, c.latest_at, c.last_activity_at, c.events
    from cards c
   where case
           when p_before_id is null then true
           when p_sort = 'active' then (c.last_activity_at, c.id) < (p_before_at, p_before_id)
           else (c.day, c.latest_at, c.id) < (p_before_day, p_before_at, p_before_id)
         end
   order by
     case when p_sort = 'active' then c.last_activity_at end desc nulls last,
     case when p_sort = 'active' then null else c.day end desc nulls last,
     case when p_sort = 'active' then null else c.latest_at end desc nulls last,
     c.id desc
   limit least(greatest(p_limit, 1), 50);
$$;

revoke all on function public.feed_cards(uuid, text, integer, date, timestamptz, uuid) from public, anon;
grant execute on function public.feed_cards(uuid, text, integer, date, timestamptz, uuid) to authenticated;
