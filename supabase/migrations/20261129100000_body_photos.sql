-- Baustein 7d (body, personal): progress photos of a check-in ("Zwischenstand").
--   body_photo_poses: the fixed poses as data (rule 5), read-only for clients.
--   body_photos: up to one live photo per check-in and pose. The files live in the private
--     Storage bucket "body-photos" under <user_id>/<checkin_id>/<pose>-<uuid>.jpg (plus
--     ...-thumb.jpg). Strictly the owner's: nobody else reads anything, not the group, not
--     its admins, not the super admin (no policy for anyone but the owner).
--
-- Lifecycle (files cannot be removed reliably from SQL, so the client purges them):
--   add_body_photo        inserts a row once both files are uploaded; replaces (soft-deletes)
--                         the live photo of the same pose.
--   deleted_at            soft delete; clearing it is the undo.
--   check-in deleted      its live photos are soft-deleted by a trigger and lose the link
--                         (checkin_id null); the rows survive until purged.
--   set_body_checkin_photos  undo of a check-in delete/change: puts exactly these photos
--                         back on the (re-saved) check-in.
--   purge (client)        body_photos_to_purge lists my rows deleted longer than a grace
--                         period ago (database time); the client removes both files via the
--                         Storage API, then deletes the rows (only soft-deleted rows can be
--                         deleted).
-- Nothing here references social tables (rule 13).

-- ---------------------------------------------------------------------------
-- Poses (global)
-- ---------------------------------------------------------------------------
create table public.body_photo_poses (
  key text primary key check (key ~ '^[a-z][a-z_]*$'),
  label text not null,
  sort smallint not null
);

insert into public.body_photo_poses (key, label, sort) values
  ('front', 'Vorne', 10),
  ('side', 'Seite', 20),
  ('back', 'Hinten', 30);

-- ---------------------------------------------------------------------------
-- Photos
-- ---------------------------------------------------------------------------

-- Target of the photos' (checkin_id, user_id) key: a check-in of the same person only.
alter table public.body_checkins add constraint body_checkins_id_user_key unique (id, user_id);

create table public.body_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- null only after the check-in was deleted (then the photo is soft-deleted, too).
  checkin_id uuid,
  pose text not null references public.body_photo_poses (key),
  -- Paths inside the bucket "body-photos"; the first folder is the owner.
  path text not null unique,
  thumb_path text not null unique,
  -- Of the full-size image.
  width integer not null check (width between 1 and 4096),
  height integer not null check (height between 1 and 4096),
  bytes integer not null check (bytes between 1 and 2097152),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (checkin_id, user_id) references public.body_checkins (id, user_id)
    on delete set null (checkin_id),
  check (deleted_at is not null or checkin_id is not null),
  check (split_part(path, '/', 1) = user_id::text and split_part(thumb_path, '/', 1) = user_id::text)
);
create index body_photos_user_idx on public.body_photos (user_id);
create index body_photos_checkin_idx on public.body_photos (checkin_id);
-- At most one live photo per check-in and pose.
create unique index body_photos_one_live_pose_idx on public.body_photos (checkin_id, pose)
  where deleted_at is null;

-- A deleted check-in takes its photos with it – softly, so that undo can bring them back
-- and the client can still remove the files (the key then sets checkin_id to null).
create function private.on_body_checkin_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.body_photos p set deleted_at = now()
   where p.checkin_id = old.id and p.deleted_at is null;
  return old;
end;
$$;

create trigger body_checkins_soft_delete_photos
  before delete on public.body_checkins
  for each row execute function private.on_body_checkin_delete();

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------
alter table public.body_photo_poses enable row level security;
alter table public.body_photos enable row level security;
revoke all on public.body_photo_poses, public.body_photos from anon, authenticated;
grant select on public.body_photo_poses, public.body_photos to authenticated;
-- Adding through add_body_photo (atomic replace); soft delete and undo by setting
-- deleted_at; deleting only rows that are soft-deleted already (the purge).
grant update (deleted_at) on public.body_photos to authenticated;
grant delete on public.body_photos to authenticated;

create policy "body_photo_poses: everyone reads" on public.body_photo_poses
  for select to authenticated using (true);
create policy "body_photos: own, read" on public.body_photos
  for select to authenticated using (user_id = (select auth.uid()));
create policy "body_photos: own, insert" on public.body_photos
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "body_photos: own, update" on public.body_photos
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "body_photos: own, delete when soft-deleted" on public.body_photos
  for delete to authenticated
  using (user_id = (select auth.uid()) and deleted_at is not null);

-- ---------------------------------------------------------------------------
-- Storage: private bucket, one folder per person, only the person
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('body-photos', 'body-photos', false, 2097152, array['image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "body-photos: own folder, read" on storage.objects
  for select to authenticated
  using (bucket_id = 'body-photos'
         and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "body-photos: own folder, insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'body-photos'
              and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "body-photos: own folder, update" on storage.objects
  for update to authenticated
  using (bucket_id = 'body-photos'
         and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'body-photos'
              and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "body-photos: own folder, delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'body-photos'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- Writing
-- ---------------------------------------------------------------------------

-- Adds a photo to my check-in once both files are in the bucket (so there is never a row
-- without its file). Replaces the live photo of the same pose (that one is soft-deleted and
-- purged later). Paths: <my id>/<checkin id>/…. p_id: the client's id. Returns the id.
create function public.add_body_photo(
  p_checkin_id uuid,
  p_pose text,
  p_path text,
  p_thumb_path text,
  p_width integer,
  p_height integer,
  p_bytes integer,
  p_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_prefix text;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.body_checkins c
                  where c.id = p_checkin_id and c.user_id = v_user) then
    raise exception 'checkin_not_found' using errcode = '42501';
  end if;
  if exists (select 1 from public.body_checkins c where c.id = p_checkin_id and c.skipped) then
    raise exception 'checkin_skipped' using errcode = '22023';
  end if;
  if not exists (select 1 from public.body_photo_poses p where p.key = p_pose) then
    raise exception 'unknown_pose: %', p_pose using errcode = '22023';
  end if;
  v_prefix := v_user::text || '/' || p_checkin_id::text || '/';
  if p_path is null or p_thumb_path is null or p_path = p_thumb_path
     or left(p_path, length(v_prefix)) <> v_prefix
     or left(p_thumb_path, length(v_prefix)) <> v_prefix then
    raise exception 'invalid_photo_path' using errcode = '22023';
  end if;
  if (select count(*) from storage.objects o
       where o.bucket_id = 'body-photos' and o.name in (p_path, p_thumb_path)) < 2 then
    raise exception 'photo_file_missing' using errcode = '22023';
  end if;

  update public.body_photos p set deleted_at = now()
   where p.checkin_id = p_checkin_id and p.pose = p_pose and p.deleted_at is null;
  insert into public.body_photos (id, user_id, checkin_id, pose, path, thumb_path, width, height, bytes)
  values (coalesce(p_id, gen_random_uuid()), v_user, p_checkin_id, p_pose, p_path, p_thumb_path,
          p_width, p_height, p_bytes)
  returning id into v_id;
  return v_id;
end;
$$;

-- Undo of a check-in delete or change: makes exactly these photos the live ones of my
-- check-in (the other live ones are soft-deleted; ids already purged are ignored). The
-- check-in must exist again (save it first). Returns how many photos are live on it.
create function public.set_body_checkin_photos(p_checkin_id uuid, p_photo_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_ids uuid[] := coalesce(p_photo_ids, '{}');
  v_count integer;
begin
  if v_user is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.body_checkins c
                  where c.id = p_checkin_id and c.user_id = v_user) then
    raise exception 'checkin_not_found' using errcode = '42501';
  end if;
  if cardinality(v_ids) > 0
     and exists (select 1 from public.body_checkins c where c.id = p_checkin_id and c.skipped) then
    raise exception 'checkin_skipped' using errcode = '22023';
  end if;

  update public.body_photos p set deleted_at = now()
   where p.checkin_id = p_checkin_id and p.deleted_at is null and p.id <> all (v_ids);
  update public.body_photos p set checkin_id = p_checkin_id, deleted_at = null
   where p.id = any (v_ids)
     and p.user_id = v_user
     and (p.checkin_id is null or p.checkin_id = p_checkin_id)
     -- The files of a photo are at its check-in's folder.
     and split_part(p.path, '/', 2) = p_checkin_id::text;

  select count(*)::integer into v_count from public.body_photos p
   where p.checkin_id = p_checkin_id and p.deleted_at is null;
  return v_count;
end;
$$;

-- Soft deletes are stamped with the database's time (the purge compares against it, so a
-- wrong clock on a phone cannot purge too early).
create function private.on_body_photo_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    new.deleted_at := now();
  end if;
  return new;
end;
$$;

create trigger body_photos_stamp_deleted_at
  before update of deleted_at on public.body_photos
  for each row execute function private.on_body_photo_update();

-- My photos that were deleted longer than p_grace_seconds ago: what the purge removes
-- (files first, then the rows). Oldest first, at most 100 at a time.
create function public.body_photos_to_purge(p_grace_seconds integer default 120)
returns table (
  id uuid,
  path text,
  thumb_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.path, p.thumb_path
    from public.body_photos p
   where p.user_id = (select auth.uid())
     and p.deleted_at is not null
     and p.deleted_at <= now() - make_interval(secs => greatest(coalesce(p_grace_seconds, 120), 0))
   order by p.deleted_at
   limit 100;
$$;

revoke all on function private.on_body_checkin_delete() from public, anon, authenticated;
revoke all on function private.on_body_photo_update() from public, anon, authenticated;
revoke all on function public.body_photos_to_purge(integer) from public, anon;
grant execute on function public.body_photos_to_purge(integer) to authenticated;
revoke all on function public.add_body_photo(uuid, text, text, text, integer, integer, integer, uuid)
  from public, anon;
revoke all on function public.set_body_checkin_photos(uuid, uuid[]) from public, anon;
grant execute on function public.add_body_photo(uuid, text, text, text, integer, integer, integer, uuid)
  to authenticated;
grant execute on function public.set_body_checkin_photos(uuid, uuid[]) to authenticated;
