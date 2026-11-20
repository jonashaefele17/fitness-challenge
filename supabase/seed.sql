-- Local development seed (runs only on `supabase db reset` / `supabase start`, never on
-- staging or live). Provides reusable invite codes so you can sign up test users locally.
--
--   DEV-ADMIN  -> admin of "Fitness Challenge" (10 uses)
--   DEV-INVITE -> member of "Fitness Challenge" (50 uses)
--   DEV-OTHER  -> member of a second group, to try multi-group behaviour (50 uses)

insert into public.groups (id, name)
values ('00000000-0000-4000-8000-000000000001', 'Fitness Challenge')
on conflict (id) do nothing;

insert into public.groups (id, name)
values ('00000000-0000-4000-8000-000000000002', 'Andere Gruppe (lokal)')
on conflict (id) do nothing;

insert into public.invites (group_id, code_hash, label, role, max_uses)
values
  ('00000000-0000-4000-8000-000000000001', private.hash_invite_code('DEV-ADMIN'), 'Local admin', 'admin', 10),
  ('00000000-0000-4000-8000-000000000001', private.hash_invite_code('DEV-INVITE'), 'Local member', 'member', 50),
  ('00000000-0000-4000-8000-000000000002', private.hash_invite_code('DEV-OTHER'), 'Local other group', 'member', 50)
on conflict (code_hash) do nothing;
