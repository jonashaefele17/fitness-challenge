-- Structured device settings: the device defines which settings it has (e.g. Beinbeuger:
-- Rückenlehne, Beinpolster; Latzug: none), each person stores a value per field and exercise.
-- Replaces the single free-text setting (no data existed yet).

alter table public.devices
  add column setting_fields text[] not null default '{}'
    check (cardinality(setting_fields) <= 6);
grant update (setting_fields) on public.devices to authenticated;

alter table public.user_device_settings drop column setting;
alter table public.user_device_settings
  add column "values" jsonb not null default '{}'::jsonb
    check (jsonb_typeof("values") = 'object');
