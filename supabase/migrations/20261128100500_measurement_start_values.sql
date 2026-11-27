-- Baustein 7c (body, personal): where the wheel starts for a measurement a person has never
-- taken. Only a starting point for rolling; nothing is saved until the person sets a value.

alter table public.body_measurement_kinds
  add column start_value numeric(5, 1) not null default 80 check (start_value between 10 and 300);

update public.body_measurement_kinds set start_value = 90 where key = 'bauch';
update public.body_measurement_kinds set start_value = 85 where key = 'taille';
update public.body_measurement_kinds set start_value = 100 where key = 'brust';
update public.body_measurement_kinds set start_value = 100 where key = 'huefte';
update public.body_measurement_kinds set start_value = 35 where key = 'oberarm';
update public.body_measurement_kinds set start_value = 58 where key = 'oberschenkel';
