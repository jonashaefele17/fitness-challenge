-- Zwischenstand photos (7d): poses as data, photos added through add_body_photo only (with
-- both files in the bucket), one live photo per pose, soft delete and undo, the check-in
-- delete with undo, the purge, and that photos and files are strictly private.
--   a1 owns the photos · a2 is in the same group · b is in another group · s is a super
--   admin in the same group

begin;
create extension if not exists pgtap with schema extensions;

select plan(67);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'a1@test.local'),
  ('22222222-2222-4222-8222-222222222222', 'a2@test.local'),
  ('33333333-3333-4333-8333-333333333333', 'b@test.local'),
  ('44444444-4444-4444-8444-444444444444', 's@test.local');
insert into public.profiles (id, display_name, color, is_super_admin) values
  ('11111111-1111-4111-8111-111111111111', 'A1', 'person-1', false),
  ('22222222-2222-4222-8222-222222222222', 'A2', 'person-2', false),
  ('33333333-3333-4333-8333-333333333333', 'B', 'person-3', false),
  ('44444444-4444-4444-8444-444444444444', 'S', 'person-4', true);
insert into public.groups (id, name) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'B');
insert into public.group_members (group_id, user_id, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'member'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'admin'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '33333333-3333-4333-8333-333333333333', 'member'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '44444444-4444-4444-8444-444444444444', 'admin');

-- The Storage API deletes rows directly; allow it here like the API does.
set local storage.allow_delete_query = 'true';

-- ---------------------------------------------------------------------------
-- Poses and the bucket
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select results_eq(
  $$select key, label from public.body_photo_poses order by sort$$,
  $$values ('front'::text, 'Vorne'::text), ('side', 'Seite'), ('back', 'Hinten')$$,
  'every signed-in person reads the three poses in their order');
select throws_ok(
  $$insert into public.body_photo_poses (key, label, sort) values ('top', 'Oben', 40)$$,
  '42501', null, 'poses cannot be added by clients');

reset role;
select results_eq(
  $$select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'body-photos'$$,
  $$values (false, 2097152::bigint, array['image/jpeg', 'image/webp'])$$,
  'the bucket is private, 2 MB per file, JPEG or WebP');
set local role authenticated;

-- ---------------------------------------------------------------------------
-- Adding (a1)
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
insert into public.body_settings (checkin_every_weeks) values (4);

select is(
  public.save_body_checkin('2026-11-01', '{}', 'c0000000-0000-4000-8000-000000000001'),
  'c0000000-0000-4000-8000-000000000001'::uuid, 'a check-in without measurements can be saved');

select lives_ok(
  $$insert into storage.objects (bucket_id, name) values
      ('body-photos', '11111111-1111-4111-8111-111111111111/c0000000-0000-4000-8000-000000000001/front-1.jpg'),
      ('body-photos', '11111111-1111-4111-8111-111111111111/c0000000-0000-4000-8000-000000000001/front-1-thumb.jpg')$$,
  'I upload into my own folder');

select throws_ok(
  $$insert into public.body_photos (checkin_id, pose, path, thumb_path, width, height, bytes)
    values ('c0000000-0000-4000-8000-000000000001', 'front',
            '11111111-1111-4111-8111-111111111111/c0000000-0000-4000-8000-000000000001/front-1.jpg',
            '11111111-1111-4111-8111-111111111111/c0000000-0000-4000-8000-000000000001/front-1-thumb.jpg',
            1200, 1600, 300000)$$,
  '42501', null, 'photos are not inserted directly');

select throws_ok(
  $$select public.add_body_photo('c0000000-0000-4000-8000-000000000001', 'front',
      '11111111-1111-4111-8111-111111111111/c0000000-0000-4000-8000-000000000001/front-9.jpg',
      '11111111-1111-4111-8111-111111111111/c0000000-0000-4000-8000-000000000001/front-9-thumb.jpg',
      1200, 1600, 300000)$$,
  '22023', 'photo_file_missing', 'no row without its files');
select throws_ok(
  $$select public.add_body_photo('c0000000-0000-4000-8000-000000000001', 'front',
      '22222222-2222-4222-8222-222222222222/c0000000-0000-4000-8000-000000000001/front-1.jpg',
      '22222222-2222-4222-8222-222222222222/c0000000-0000-4000-8000-000000000001/front-1-thumb.jpg',
      1200, 1600, 300000)$$,
  '22023', 'invalid_photo_path', 'paths must be in my folder of this check-in');
select throws_ok(
  $$select public.add_body_photo('c0000000-0000-4000-8000-000000000001', 'top',
      '11111111-1111-4111-8111-111111111111/c0000000-0000-4000-8000-000000000001/front-1.jpg',
      '11111111-1111-4111-8111-111111111111/c0000000-0000-4000-8000-000000000001/front-1-thumb.jpg',
      1200, 1600, 300000)$$,
  '22023', null, 'unknown poses are rejected');

select is(
  public.add_body_photo('c0000000-0000-4000-8000-000000000001', 'front',
    '11111111-1111-4111-8111-111111111111/c0000000-0000-4000-8000-000000000001/front-1.jpg',
    '11111111-1111-4111-8111-111111111111/c0000000-0000-4000-8000-000000000001/front-1-thumb.jpg',
    1200, 1600, 300000, 'f0000000-0000-4000-8000-000000000001'),
  'f0000000-0000-4000-8000-000000000001'::uuid, 'add_body_photo adds it with the client''s id');
select results_eq(
  $$select user_id, checkin_id, pose, width, height, bytes, deleted_at is null from public.body_photos$$,
  $$values ('11111111-1111-4111-8111-111111111111'::uuid, 'c0000000-0000-4000-8000-000000000001'::uuid,
            'front'::text, 1200, 1600, 300000, true)$$,
  'my photo, live, on my check-in');

select results_eq(
  $$select last_done_on, due from public.body_checkin_status('11111111-1111-4111-8111-111111111111', '2026-11-02')$$,
  $$values ('2026-11-01'::date, false)$$,
  'a check-in with photos only counts as done');

-- Replacing the photo of a pose
insert into storage.objects (bucket_id, name) values
  ('body-photos', '11111111-1111-4111-8111-111111111111/c0000000-0000-4000-8000-000000000001/front-2.jpg'),
  ('body-photos', '11111111-1111-4111-8111-111111111111/c0000000-0000-4000-8000-000000000001/front-2-thumb.jpg'),
  ('body-photos', '11111111-1111-4111-8111-111111111111/c0000000-0000-4000-8000-000000000001/side-1.jpg'),
  ('body-photos', '11111111-1111-4111-8111-111111111111/c0000000-0000-4000-8000-000000000001/side-1-thumb.jpg');
select public.add_body_photo('c0000000-0000-4000-8000-000000000001', 'front',
  '11111111-1111-4111-8111-111111111111/c0000000-0000-4000-8000-000000000001/front-2.jpg',
  '11111111-1111-4111-8111-111111111111/c0000000-0000-4000-8000-000000000001/front-2-thumb.jpg',
  1200, 1600, 310000, 'f0000000-0000-4000-8000-000000000002');
select public.add_body_photo('c0000000-0000-4000-8000-000000000001', 'side',
  '11111111-1111-4111-8111-111111111111/c0000000-0000-4000-8000-000000000001/side-1.jpg',
  '11111111-1111-4111-8111-111111111111/c0000000-0000-4000-8000-000000000001/side-1-thumb.jpg',
  1200, 1600, 290000, 'f0000000-0000-4000-8000-000000000003');
select results_eq(
  $$select id, pose, deleted_at is null from public.body_photos order by id$$,
  $$values ('f0000000-0000-4000-8000-000000000001'::uuid, 'front'::text, false),
           ('f0000000-0000-4000-8000-000000000002', 'front', true),
           ('f0000000-0000-4000-8000-000000000003', 'side', true)$$,
  'a new photo of a pose replaces the live one (soft-deleted)');

-- Soft delete and undo
select throws_ok(
  $$update public.body_photos set deleted_at = null where id = 'f0000000-0000-4000-8000-000000000001'$$,
  '23505', null, 'at most one live photo per pose');
update public.body_photos set deleted_at = '2000-01-01' where id = 'f0000000-0000-4000-8000-000000000003';
select is((select deleted_at from public.body_photos where id = 'f0000000-0000-4000-8000-000000000003'),
  now(), 'deleting sets deleted_at, with the database''s time');
update public.body_photos set deleted_at = null where id = 'f0000000-0000-4000-8000-000000000003';
select is((select count(*) from public.body_photos where deleted_at is null), 2::bigint,
  'undo clears it');
select throws_ok(
  $$update public.body_photos set path = 'x' where id = 'f0000000-0000-4000-8000-000000000003'$$,
  '42501', null, 'only deleted_at can be changed');
select throws_ok(
  $$update public.body_photos set checkin_id = null where id = 'f0000000-0000-4000-8000-000000000003'$$,
  '42501', null, 'the check-in of a photo cannot be changed directly');
select is_empty(
  $$delete from public.body_photos where id = 'f0000000-0000-4000-8000-000000000002' returning id$$,
  'a live photo cannot be deleted (only soft-deleted ones are purged)');

-- Skipping
select is(public.skip_body_checkin('2026-11-01'), 'c0000000-0000-4000-8000-000000000001'::uuid,
  'skipping a day with photos returns its check-in');
select results_eq(
  $$select c.skipped, (select count(*) from public.body_photos p
                         where p.checkin_id = c.id and p.deleted_at is null)
      from public.body_checkins c where c.id = 'c0000000-0000-4000-8000-000000000001'$$,
  $$values (false, 2::bigint)$$,
  'and leaves it done with its photos');
select public.skip_body_checkin('2026-11-29', 'c0000000-0000-4000-8000-000000000002');
select throws_ok(
  $$select public.add_body_photo('c0000000-0000-4000-8000-000000000002', 'front',
      '11111111-1111-4111-8111-111111111111/c0000000-0000-4000-8000-000000000002/front-1.jpg',
      '11111111-1111-4111-8111-111111111111/c0000000-0000-4000-8000-000000000002/front-1-thumb.jpg',
      1200, 1600, 300000)$$,
  '22023', 'checkin_skipped', 'a skipped check-in takes no photos');

-- ---------------------------------------------------------------------------
-- Private: the same group (also its admin) sees and changes nothing
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';
select is((select count(*) from public.body_photos), 0::bigint, 'same group: no photo rows');
select is((select count(*) from storage.objects where bucket_id = 'body-photos'), 0::bigint,
  'same group: no files');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values
      ('body-photos', '11111111-1111-4111-8111-111111111111/c0000000-0000-4000-8000-000000000001/front-x.jpg')$$,
  '42501', null, 'same group: cannot write into someone else''s folder');
select is_empty(
  $$update storage.objects set metadata = '{"x": 1}'
     where bucket_id = 'body-photos' returning name$$,
  'same group: cannot change someone else''s files');
select is_empty(
  $$delete from storage.objects where bucket_id = 'body-photos' returning name$$,
  'same group: cannot delete someone else''s files');
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values
      ('body-photos', '22222222-2222-4222-8222-222222222222/c0000000-0000-4000-8000-000000000009/front-1.jpg')$$,
  'same group: uploads into the own folder');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('body-photos', 'front-1.jpg')$$,
  '42501', null, 'nobody writes outside a person folder');
select throws_ok(
  $$select public.add_body_photo('c0000000-0000-4000-8000-000000000001', 'back',
      '22222222-2222-4222-8222-222222222222/c0000000-0000-4000-8000-000000000001/back-1.jpg',
      '22222222-2222-4222-8222-222222222222/c0000000-0000-4000-8000-000000000001/back-1-thumb.jpg',
      1200, 1600, 300000)$$,
  '42501', 'checkin_not_found', 'same group: cannot attach a photo to someone else''s check-in');
select throws_ok(
  $$select public.set_body_checkin_photos('c0000000-0000-4000-8000-000000000001', '{}')$$,
  '42501', 'checkin_not_found', 'same group: cannot change the photos of someone else''s check-in');
select is_empty(
  $$update public.body_photos set deleted_at = now() returning id$$,
  'same group: cannot delete someone else''s photos softly');
select is_empty(
  $$delete from public.body_photos returning id$$,
  'same group: cannot delete someone else''s photo rows');

-- ---------------------------------------------------------------------------
-- Another group and the super admin see nothing either
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select is((select count(*) from public.body_photos), 0::bigint, 'other group: no photo rows');
select is((select count(*) from storage.objects where bucket_id = 'body-photos'), 0::bigint,
  'other group: no files');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values
      ('body-photos', '11111111-1111-4111-8111-111111111111/c0000000-0000-4000-8000-000000000001/back-x.jpg')$$,
  '42501', null, 'other group: cannot write into someone else''s folder');
select is_empty(
  $$delete from storage.objects where bucket_id = 'body-photos' returning name$$,
  'other group: cannot delete someone else''s files');

set local request.jwt.claims to '{"sub": "44444444-4444-4444-8444-444444444444", "role": "authenticated"}';
select is((select count(*) from public.body_photos), 0::bigint, 'super admin: no photo rows');
select is((select count(*) from storage.objects where bucket_id = 'body-photos'), 0::bigint,
  'super admin: no files');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values
      ('body-photos', '11111111-1111-4111-8111-111111111111/c0000000-0000-4000-8000-000000000001/back-x.jpg')$$,
  '42501', null, 'super admin: cannot write into someone else''s folder');
select is_empty(
  $$update storage.objects set metadata = '{"x": 1}'
     where bucket_id = 'body-photos' returning name$$,
  'super admin: cannot change someone else''s files');
select is_empty(
  $$delete from storage.objects where bucket_id = 'body-photos' returning name$$,
  'super admin: cannot delete someone else''s files');
select is_empty(
  $$delete from public.body_photos returning id$$,
  'super admin: cannot delete someone else''s photo rows');

-- ---------------------------------------------------------------------------
-- Back as the owner: nothing was changed by the others
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select results_eq(
  $$select count(*), count(*) filter (where metadata is null) from storage.objects
     where bucket_id = 'body-photos'$$,
  $$values (6::bigint, 6::bigint)$$,
  'I see my 6 files (and not the other person''s), unchanged');
select is((select count(*) from public.body_photos where deleted_at is null), 2::bigint,
  'my photos are still live');
select lives_ok(
  $$update storage.objects set metadata = '{"x": 1}'
     where name = '11111111-1111-4111-8111-111111111111/c0000000-0000-4000-8000-000000000001/front-1.jpg'$$,
  'I can change my own files');

-- ---------------------------------------------------------------------------
-- Deleting a check-in: photos soft-deleted, undo brings them back
-- ---------------------------------------------------------------------------
delete from public.body_checkins where id = 'c0000000-0000-4000-8000-000000000001';
select results_eq(
  $$select id, checkin_id, deleted_at is not null from public.body_photos order by id$$,
  $$values ('f0000000-0000-4000-8000-000000000001'::uuid, null::uuid, true),
           ('f0000000-0000-4000-8000-000000000002', null, true),
           ('f0000000-0000-4000-8000-000000000003', null, true)$$,
  'deleting a check-in soft-deletes its photos; the rows stay until purged');
select throws_ok(
  $$update public.body_photos set deleted_at = null where id = 'f0000000-0000-4000-8000-000000000002'$$,
  '23514', null, 'a photo without check-in cannot be live');
select throws_ok(
  $$select public.set_body_checkin_photos('c0000000-0000-4000-8000-000000000001',
      array['f0000000-0000-4000-8000-000000000002'::uuid])$$,
  '42501', 'checkin_not_found', 'undo needs the check-in saved again first');

select public.save_body_checkin('2026-11-01', '{"bauch": 90}', 'c0000000-0000-4000-8000-000000000001');
select is(
  public.set_body_checkin_photos('c0000000-0000-4000-8000-000000000001',
    array['f0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000003']::uuid[]),
  2, 'undo: the photos it had are live on it again');
select results_eq(
  $$select id, checkin_id, deleted_at is null from public.body_photos order by id$$,
  $$values ('f0000000-0000-4000-8000-000000000001'::uuid, null::uuid, false),
           ('f0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001'::uuid, true),
           ('f0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', true)$$,
  'the replaced one stays deleted');

-- Undo of a change: exactly the photos it had before
select is(
  public.set_body_checkin_photos('c0000000-0000-4000-8000-000000000001',
    array['f0000000-0000-4000-8000-000000000003']::uuid[]),
  1, 'photos not in the list are soft-deleted');
select is(
  public.set_body_checkin_photos('c0000000-0000-4000-8000-000000000002', '{}'),
  0, 'an empty list on a skipped check-in is fine');
select throws_ok(
  $$select public.set_body_checkin_photos('c0000000-0000-4000-8000-000000000002',
      array['f0000000-0000-4000-8000-000000000003'::uuid])$$,
  '22023', 'checkin_skipped', 'photos cannot go onto a skipped check-in');
select throws_ok(
  $$select public.set_body_checkin_photos('c0000000-0000-4000-8000-000000000003',
      array['f0000000-0000-4000-8000-000000000003'::uuid])$$,
  '42501', 'checkin_not_found', 'an unknown check-in is refused');

-- A photo cannot move to another check-in
select public.save_body_checkin('2026-12-01', '{}', 'c0000000-0000-4000-8000-000000000004');
select is(
  public.set_body_checkin_photos('c0000000-0000-4000-8000-000000000004',
    array['f0000000-0000-4000-8000-000000000003']::uuid[]),
  0, 'a photo of another check-in is not moved');
select results_eq(
  $$select checkin_id, deleted_at is null from public.body_photos
     where id = 'f0000000-0000-4000-8000-000000000003'$$,
  $$values ('c0000000-0000-4000-8000-000000000001'::uuid, true)$$,
  'it stays where it was');

-- ---------------------------------------------------------------------------
-- Without undo: the purge removes the files and then the rows
-- ---------------------------------------------------------------------------
delete from public.body_checkins where id = 'c0000000-0000-4000-8000-000000000001';
select is((select count(*) from public.body_photos where deleted_at is not null), 3::bigint,
  'all photos of the deleted check-in wait for the purge');
select is((select count(*) from public.body_photos_to_purge(120)), 0::bigint,
  'nothing to purge within the grace period');
select is((select count(*) from public.body_photos_to_purge(0)), 3::bigint,
  'after it, all three are to purge');
select is(
  (select count(*) from storage.objects o
     join public.body_photos_to_purge(0) p on o.name in (p.path, p.thumb_path)
    where o.bucket_id = 'body-photos'),
  6::bigint, 'with both files of each photo');
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';
select is((select count(*) from public.body_photos_to_purge(0)), 0::bigint,
  'nobody else gets my photos to purge');
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select lives_ok(
  $$delete from storage.objects o using public.body_photos_to_purge(0) p
     where o.bucket_id = 'body-photos' and o.name in (p.path, p.thumb_path)$$,
  'I can remove my files');
select lives_ok(
  $$delete from public.body_photos where deleted_at is not null$$,
  'and then the rows');
select is((select count(*) from public.body_photos), 0::bigint, 'no rows left');
select is((select count(*) from storage.objects where bucket_id = 'body-photos'), 0::bigint,
  'no files left');

-- The other person's file is untouched.
reset role;
select is((select count(*) from storage.objects
            where bucket_id = 'body-photos'
              and name like '22222222-2222-4222-8222-222222222222/%'), 1::bigint,
  'the other person''s file is still there');

select * from finish();
rollback;
