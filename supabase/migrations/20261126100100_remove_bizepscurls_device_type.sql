-- Catalogue clean-up: "Bizepscurls am Kabel" is an exercise at the cable tower, not a device
-- type of its own, and it does not belong to the butterfly machine. Both were created by hand
-- while testing. Tolerant: does nothing where these entries do not exist.
-- History stays: workouts done on the wrong device type move to the cable tower of that place.

do $cleanup$
declare
  v_wrong uuid;
  v_tower uuid;
  v_target uuid;
  d record;
begin
  -- 1. The exercise is not done on the butterfly machine.
  delete from public.device_type_exercises x
   using public.device_types t, public.exercises e
   where t.id = x.device_type_id and e.id = x.exercise_id
     and lower(btrim(t.name)) = 'butterfly'
     and lower(btrim(e.name)) = lower('Bizepscurls am Kabel');

  -- 2. The device type of the same name goes away.
  select id into v_wrong from public.device_types
   where lower(btrim(name)) = lower('Bizepscurls am Kabel');
  if v_wrong is null then
    return;
  end if;
  select id into v_tower from public.device_types where lower(btrim(name)) = 'kabelturm';

  if v_tower is not null then
    for d in select id, location_id from public.devices where device_type_id = v_wrong loop
      select id into v_target from public.devices
       where location_id = d.location_id and device_type_id = v_tower;
      if v_target is null then
        insert into public.devices (location_id, device_type_id)
        values (d.location_id, v_tower)
        returning id into v_target;
      end if;
      update public.workout_items set device_id = v_target where device_id = d.id;
      delete from public.user_device_settings s
       where s.device_id = d.id
         and exists (select 1 from public.user_device_settings k
                      where k.device_id = v_target and k.user_id = s.user_id
                        and k.exercise_id = s.exercise_id);
      update public.user_device_settings set device_id = v_target where device_id = d.id;
    end loop;
    update public.workout_template_items set device_type_id = v_tower
     where device_type_id = v_wrong;
  end if;

  delete from public.devices where device_type_id = v_wrong;
  delete from public.device_types where id = v_wrong;
end
$cleanup$;
