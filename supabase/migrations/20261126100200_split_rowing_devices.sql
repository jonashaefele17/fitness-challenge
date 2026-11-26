-- Rowing is two different devices: the cable row station ("Ruderzug": bench, foot plates, low
-- pulley) and the lever machine with chest pad ("Rudermaschine"). The starter catalogue had both
-- cable exercises on "Rudermaschine". They move to "Ruderzug", together with their history;
-- "Rudermaschine" keeps only "Rudern an der Maschine". Tolerant of missing entries.

do $split$
declare
  v_machine uuid;
  v_cable uuid;
  v_target uuid;
  v_moved uuid[];
  d record;
begin
  select id into v_machine from public.device_types where lower(btrim(name)) = 'rudermaschine';
  select id into v_cable from public.device_types where lower(btrim(name)) = 'ruderzug';
  if v_machine is null or v_cable is null then
    return;
  end if;

  select coalesce(array_agg(id), '{}') into v_moved from public.exercises
   where lower(btrim(name)) in (lower('Enges Rudern sitzend'), lower('Rudern breit'))
     and merged_into is null;

  -- Links: off the machine, onto the cable row station.
  delete from public.device_type_exercises
   where device_type_id = v_machine and exercise_id = any (v_moved);
  insert into public.device_type_exercises (device_type_id, exercise_id, added_by)
  select v_cable, e, null from unnest(v_moved) as e
  on conflict do nothing;

  -- History and settings of these exercises follow to the cable row station of the same place.
  for d in select id, location_id from public.devices where device_type_id = v_machine loop
    continue when not exists (
      select 1 from public.workout_items
       where device_id = d.id and exercise_id = any (v_moved)
      union all
      select 1 from public.user_device_settings
       where device_id = d.id and exercise_id = any (v_moved));
    select id into v_target from public.devices
     where location_id = d.location_id and device_type_id = v_cable;
    if v_target is null then
      insert into public.devices (location_id, device_type_id)
      values (d.location_id, v_cable)
      returning id into v_target;
    end if;
    update public.workout_items set device_id = v_target
     where device_id = d.id and exercise_id = any (v_moved);
    delete from public.user_device_settings s
     where s.device_id = d.id and s.exercise_id = any (v_moved)
       and exists (select 1 from public.user_device_settings k
                    where k.device_id = v_target and k.user_id = s.user_id
                      and k.exercise_id = s.exercise_id);
    update public.user_device_settings set device_id = v_target
     where device_id = d.id and exercise_id = any (v_moved);
    delete from public.device_hidden_exercises
     where device_id = d.id and exercise_id = any (v_moved);
  end loop;

  update public.workout_template_items set device_type_id = v_cable
   where device_type_id = v_machine and exercise_id = any (v_moved);
end
$split$;
