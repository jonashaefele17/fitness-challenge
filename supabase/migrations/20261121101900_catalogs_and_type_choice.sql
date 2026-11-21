-- Exercise catalogues per kind of training, allowed focuses per training type, and choosing
-- which training types I use.
--
-- * exercises.catalog: 'strength' or 'mobility'. Mobility exercises (stretches, flows) live in
--   their own catalogue and never show up in the strength picker, and vice versa.
-- * training_types.catalog: which catalogue a type's exercises come from (Mobility: mobility).
-- * training_types.focus_ids: the focuses that make sense for a type (null: all). Mobility
--   only gets Oberkörper, Unterkörper, Ganzkörper.
-- * training_prefs.hidden_training_type_ids: default types are a catalogue to pick from; a
--   person hides the ones they do not use.

alter table public.exercises
  add column catalog text not null default 'strength' check (catalog in ('strength', 'mobility'));
grant update (catalog) on public.exercises to authenticated;

alter table public.training_types
  add column catalog text not null default 'strength' check (catalog in ('strength', 'mobility')),
  add column focus_ids uuid[];
grant update (catalog, focus_ids) on public.training_types to authenticated;

update public.training_types
   set catalog = 'mobility',
       focus_ids = array(
         select f.id from public.training_focuses f
          where f.owner_id is null and f.name in ('Oberkörper', 'Unterkörper', 'Ganzkörper')
          order by f.sort)
 where owner_id is null and guided;

-- Exercises already used in guided routines or workouts belong to the mobility catalogue.
update public.exercises e
   set catalog = 'mobility'
 where exists (
         select 1 from public.workout_template_items i
           join public.workout_templates t on t.id = i.template_id
           join public.training_types tt on tt.id = t.training_type_id
          where i.exercise_id = e.id and tt.guided)
    or exists (
         select 1 from public.workout_items wi
           join public.workouts w on w.id = wi.workout_id
           join public.training_types tt on tt.id = w.training_type_id
          where wi.exercise_id = e.id and tt.guided);

alter table public.training_prefs
  add column hidden_training_type_ids uuid[] not null default '{}';

-- Search within one catalogue (strength by default).
drop function public.search_exercises(text, integer);
create function public.search_exercises(
  p_query text,
  p_limit integer default 20,
  p_catalog text default 'strength'
)
returns table (id uuid, name text, measure public.exercise_measure, matched_alias text)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (select lower(btrim(coalesce(p_query, ''))) as term)
  select e.id, e.name, e.measure,
         (select a.alias from public.exercise_aliases a
           where a.exercise_id = e.id and lower(a.alias) like '%' || q.term || '%'
           limit 1) as matched_alias
    from public.exercises e, q
   where e.merged_into is null
     and e.catalog = coalesce(p_catalog, 'strength')
     and (q.term = ''
       or lower(e.name) like '%' || q.term || '%'
       or exists (select 1 from public.exercise_aliases a
                   where a.exercise_id = e.id and lower(a.alias) like '%' || q.term || '%'))
   order by (lower(e.name) = q.term) desc,
            (lower(e.name) like q.term || '%') desc,
            e.name
   limit least(greatest(p_limit, 1), 50);
$$;

revoke all on function public.search_exercises(text, integer, text) from public, anon;
grant execute on function public.search_exercises(text, integer, text) to authenticated;
