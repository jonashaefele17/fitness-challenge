-- People may remove exercise links they added themselves (e.g. a mis-tap); the super admin
-- may remove any. History is unaffected: workouts reference the exercise, not the link.

drop policy "device_type_exercises: super admin removes" on public.device_type_exercises;
create policy "device_type_exercises: own or super admin removes" on public.device_type_exercises
  for delete to authenticated
  using (added_by = (select auth.uid()) or private.is_super_admin());
