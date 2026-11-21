-- Fix: for a machine, items without a device made history_scope_matches return NULL instead
-- of false. previous_sets orders by it descending, where NULL sorts first, so an old workout
-- without a device always won and the card showed "Vorher (anderes Gerät)".

create or replace function private.history_scope_matches(p_device_id uuid, p_item_device_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    case
      when p_device_id is not null and not coalesce(private.device_comparable(p_device_id), true)
        then p_item_device_id = p_device_id
      else p_item_device_id is null
        or coalesce(private.device_comparable(p_item_device_id), true)
    end,
    false
  );
$$;
