-- Core schema: profiles, groups (tenants), group memberships and invites.
--
-- Multi-group rules (CLAUDE.md, architecture rule 12):
--   * groups are tenants; a person can be in many groups (group_members is n:m).
--   * roles live on the membership (group_members.role); profiles.is_super_admin is global.
--   * every policy checks membership through the helpers in schema "private",
--     never against a hard-coded group.
--   * default is private: tables only expose what a policy explicitly allows.

-- ---------------------------------------------------------------------------
-- Schema for internal helpers (not exposed through the Data API)
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.group_role as enum ('admin', 'member');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
    check (char_length(btrim(display_name)) between 1 and 40),
  home_gym text
    check (home_gym is null or char_length(btrim(home_gym)) between 1 and 60),
  -- Key of a person colour token (--color-person-N in the design tokens).
  color text not null check (color ~ '^person-[1-8]$'),
  avatar_url text,
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'One row per person; created when the first invite is redeemed.';
comment on column public.profiles.is_super_admin is
  'Global management rights. Not writable by users; grants no read access to private data.';

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.groups is 'Tenant: a circle of friends running challenges together.';

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  -- SHA-256 of the normalised code. The plain code is only shown once at creation.
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  label text check (label is null or char_length(label) <= 60),
  role public.group_role not null default 'member',
  grants_super_admin boolean not null default false,
  max_uses integer not null default 1 check (max_uses > 0),
  used_count integer not null default 0,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint invites_used_count_range check (used_count between 0 and max_uses)
);
create index invites_group_id_idx on public.invites (group_id);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.group_role not null default 'member',
  invite_id uuid references public.invites (id) on delete set null,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_id_idx on public.group_members (user_id);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

create trigger groups_set_updated_at
  before update on public.groups
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Membership helpers (SECURITY DEFINER so policies do not recurse into RLS)
-- ---------------------------------------------------------------------------
create function private.is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id and gm.user_id = (select auth.uid())
  );
$$;

create function private.is_group_admin(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = (select auth.uid())
      and gm.role = 'admin'
  );
$$;

-- True if the current user is p_user_id or shares at least one group with them.
create function private.shares_group_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id = (select auth.uid())
    or exists (
      select 1
      from public.group_members mine
      join public.group_members theirs on theirs.group_id = mine.group_id
      where mine.user_id = (select auth.uid()) and theirs.user_id = p_user_id
    );
$$;

create function private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_super_admin from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

-- Invite code normalisation: case-insensitive, ignores spaces and dashes.
create function private.hash_invite_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(
    extensions.digest(upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')), 'sha256'),
    'hex'
  );
$$;

revoke all on all functions in schema private from public;
grant execute on function private.is_group_member(uuid) to authenticated;
grant execute on function private.is_group_admin(uuid) to authenticated;
grant execute on function private.shares_group_with(uuid) to authenticated;
grant execute on function private.is_super_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges: start from nothing, grant only what the policies need.
-- Inserts into profiles/group_members and invite redemption go through RPCs.
-- ---------------------------------------------------------------------------
revoke all on public.profiles, public.groups, public.group_members, public.invites
  from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, home_gym, avatar_url) on public.profiles to authenticated;

grant select on public.groups to authenticated;
grant update (name) on public.groups to authenticated;

grant select on public.group_members to authenticated;
grant update (role) on public.group_members to authenticated;
grant delete on public.group_members to authenticated;

-- code_hash is never readable through the API.
grant select (
  id, group_id, label, role, grants_super_admin, max_uses, used_count,
  expires_at, revoked_at, created_by, created_at
) on public.invites to authenticated;
grant update (revoked_at) on public.invites to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.invites enable row level security;

-- profiles: visible to people who share a group; only the owner can edit.
create policy "profiles: read own and group mates"
  on public.profiles for select to authenticated
  using (private.shares_group_with(id) or private.is_super_admin());

create policy "profiles: owner updates"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- groups
create policy "groups: members read"
  on public.groups for select to authenticated
  using (private.is_group_member(id) or private.is_super_admin());

create policy "groups: admins update"
  on public.groups for update to authenticated
  using (private.is_group_admin(id))
  with check (private.is_group_admin(id));

-- group_members
create policy "group_members: members read their groups"
  on public.group_members for select to authenticated
  using (private.is_group_member(group_id) or private.is_super_admin());

create policy "group_members: admins change roles"
  on public.group_members for update to authenticated
  using (private.is_group_admin(group_id))
  with check (private.is_group_admin(group_id));

create policy "group_members: admins remove members"
  on public.group_members for delete to authenticated
  using (private.is_group_admin(group_id));

-- invites: only admins of the invite's group
create policy "invites: admins read"
  on public.invites for select to authenticated
  using (private.is_group_admin(group_id));

create policy "invites: admins revoke"
  on public.invites for update to authenticated
  using (private.is_group_admin(group_id))
  with check (private.is_group_admin(group_id));

-- ---------------------------------------------------------------------------
-- RPC: check_invite — lets the onboarding show which group a code belongs to.
-- Returns no row for unknown, revoked, expired or used-up codes.
-- ---------------------------------------------------------------------------
create function public.check_invite(p_code text)
returns table (group_id uuid, group_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.name
  from public.invites i
  join public.groups g on g.id = i.group_id
  where (select auth.uid()) is not null
    and i.code_hash = private.hash_invite_code(p_code)
    and i.revoked_at is null
    and (i.expires_at is null or i.expires_at > now())
    and i.used_count < i.max_uses;
$$;

-- ---------------------------------------------------------------------------
-- RPC: redeem_invite — joins the invite's group.
--   * first redemption: creates the profile (display name required)
--   * later redemptions (another group): only adds the membership
-- Errors (message): not_authenticated, invite_invalid, already_member, display_name_required
-- ---------------------------------------------------------------------------
create function public.redeem_invite(
  p_code text,
  p_display_name text default null,
  p_home_gym text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_invite public.invites%rowtype;
  v_color text;
  v_avatar_url text;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_invite
  from public.invites
  where code_hash = private.hash_invite_code(p_code)
  for update;

  if not found
    or v_invite.revoked_at is not null
    or (v_invite.expires_at is not null and v_invite.expires_at <= now())
    or v_invite.used_count >= v_invite.max_uses then
    raise exception 'invite_invalid' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.group_members
    where group_id = v_invite.group_id and user_id = v_user_id
  ) then
    raise exception 'already_member' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.profiles where id = v_user_id) then
    if nullif(btrim(coalesce(p_display_name, '')), '') is null then
      raise exception 'display_name_required' using errcode = 'P0001';
    end if;

    -- Least used person colour within the group; ties go to the lowest number.
    select 'person-' || n into v_color
    from generate_series(1, 8) as n
    order by (
      select count(*)
      from public.group_members gm
      join public.profiles p on p.id = gm.user_id
      where gm.group_id = v_invite.group_id and p.color = 'person-' || n
    ), n
    limit 1;

    select u.raw_user_meta_data ->> 'avatar_url' into v_avatar_url
    from auth.users u where u.id = v_user_id;

    insert into public.profiles (id, display_name, home_gym, color, avatar_url)
    values (
      v_user_id,
      btrim(p_display_name),
      nullif(btrim(coalesce(p_home_gym, '')), ''),
      v_color,
      v_avatar_url
    );
  end if;

  if v_invite.grants_super_admin then
    update public.profiles set is_super_admin = true where id = v_user_id;
  end if;

  insert into public.group_members (group_id, user_id, role, invite_id)
  values (v_invite.group_id, v_user_id, v_invite.role, v_invite.id);

  update public.invites set used_count = used_count + 1 where id = v_invite.id;

  return v_invite.group_id;
end;
$$;

revoke all on function public.check_invite(text) from public, anon;
revoke all on function public.redeem_invite(text, text, text) from public, anon;
grant execute on function public.check_invite(text) to authenticated;
grant execute on function public.redeem_invite(text, text, text) to authenticated;
