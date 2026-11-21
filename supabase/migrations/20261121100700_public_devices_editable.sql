-- Devices at public studios are shared equipment: every signed-in member may edit them
-- (name, weight steps, setting fields, comparability), not only their creator. Private places
-- (e.g. Home Gym) stay editable by their owner only; the super admin can always correct.

create or replace function private.can_edit_device(p_device_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.devices d
      join public.locations l on l.id = d.location_id
     where d.id = p_device_id
       and (
         l.owner_id is null
         or l.owner_id = (select auth.uid())
         or private.can_edit_catalog(d.created_by)
       )
  );
$$;
