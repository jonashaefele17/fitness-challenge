-- Catalogue clean-up: the bench is an accessory, not a device type. No weight is moved on the
-- bench itself; every exercise on it is a dumbbell exercise and is offered under "Kurzhanteln".
-- Tolerant: does nothing where the type does not exist.
-- History stays: workouts logged on a bench move to the dumbbells of that place.

do $cleanup$
declare
  v_bench uuid;
  v_dumbbells uuid;
  v_target uuid;
  d record;
begin
  select id into v_bench from public.device_types where lower(btrim(name)) = 'hantelbank';
  if v_bench is null then
    return;
  end if;
  select id into v_dumbbells from public.device_types where lower(btrim(name)) = 'kurzhanteln';

  if v_dumbbells is not null then
    -- Exercises that were only linked to the bench stay available with the dumbbells.
    insert into public.device_type_exercises (device_type_id, exercise_id, added_by)
    select v_dumbbells, x.exercise_id, x.added_by
      from public.device_type_exercises x
     where x.device_type_id = v_bench
    on conflict do nothing;

    for d in select id, location_id from public.devices where device_type_id = v_bench loop
      select id into v_target from public.devices
       where location_id = d.location_id and device_type_id = v_dumbbells;
      if v_target is null then
        insert into public.devices (location_id, device_type_id)
        values (d.location_id, v_dumbbells)
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
    update public.workout_template_items set device_type_id = v_dumbbells
     where device_type_id = v_bench;
  end if;

  delete from public.device_type_exercises where device_type_id = v_bench;
  delete from public.devices where device_type_id = v_bench;
  delete from public.device_types where id = v_bench;
end
$cleanup$;
