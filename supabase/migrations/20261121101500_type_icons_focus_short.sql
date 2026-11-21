-- Training log calendar: every cell shows what was trained.
--   training_types.icon       key of a drawn icon (barbell, home_gym, run …); unknown keys fall
--                             back to a neutral icon in the app, so new icons need no migration
--   training_focuses.short_name  ≤ 5 characters for a calendar cell (Push, Pull, Beine, OK …)
-- Plus Tischtennis as a default training type.

alter table public.training_types
  add column icon text not null default 'generic' check (icon ~ '^[a-z][a-z_]{1,29}$');
grant update (icon) on public.training_types to authenticated;

update public.training_types set icon = case name
    when 'Studio' then 'barbell'
    when 'Home Gym' then 'home_gym'
    when 'Laufen' then 'run'
    when 'Radfahren' then 'bike'
    when 'Fußball' then 'football'
    else icon
  end
 where owner_id is null;

insert into public.training_types (name, kind, with_distance, sort, icon)
values ('Tischtennis', 'duration', false, 45, 'table_tennis');

alter table public.training_focuses
  add column short_name text check (short_name is null or char_length(btrim(short_name)) between 1 and 5);
grant update (short_name) on public.training_focuses to authenticated;

update public.training_focuses set short_name = case name
    when 'Push' then 'Push'
    when 'Pull' then 'Pull'
    when 'Beine' then 'Beine'
    when 'Oberkörper' then 'OK'
    when 'Unterkörper' then 'UK'
    when 'Arme' then 'Arme'
    when 'Ganzkörper' then 'GK'
  end
 where owner_id is null;
