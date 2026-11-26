import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUserId } from '@/features/auth';
import { supabase } from '@/shared/lib/supabase';
import type {
  Device,
  ExerciseCatalog,
  ExerciseMeasure,
  ExerciseSummary,
  TrainingFocus,
  TrainingType,
  TrendPoint,
} from '../types';
import { trainingKeys } from './keys';

/** All training types I can use (defaults and mine), including ones I hid. */
export function useAllTrainingTypes() {
  const userId = useUserId();
  return useQuery({
    queryKey: trainingKeys.types(userId),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<TrainingType[]> => {
      const { data, error } = await supabase
        .from('training_types')
        .select(
          'id, name, kind, with_distance, owner_id, location_mode, variants, icon, guided, catalog, focus_ids',
        )
        .is('archived_at', null)
        .or(`owner_id.is.null,owner_id.eq.${userId}`)
        .order('sort')
        .order('name');
      if (error) throw error;
      return data.map((row) => ({
        id: row.id,
        name: row.name,
        kind: row.kind === 'duration' ? 'duration' : 'exercises',
        withDistance: row.with_distance,
        ownerId: row.owner_id,
        locationMode:
          row.location_mode === 'home_studio' || row.location_mode === 'private'
            ? row.location_mode
            : 'none',
        variants: row.variants,
        icon: row.icon,
        guided: row.guided,
        catalog: row.catalog === 'mobility' ? 'mobility' : 'strength',
        focusIds: row.focus_ids,
      }));
    },
  });
}

/** Training types I hid (the defaults are a catalogue to pick from). */
export function useHiddenTrainingTypes() {
  const userId = useUserId();
  return useQuery({
    queryKey: [...trainingKeys.types(userId), 'hidden'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('training_prefs')
        .select('hidden_training_type_ids')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data?.hidden_training_type_ids ?? [];
    },
  });
}

/** Show or hide a training type in my selection (start, templates, …). */
export function useSetTrainingTypeHidden() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  const key = [...trainingKeys.types(userId), 'hidden'];
  return useMutation({
    mutationFn: async ({ id, hidden }: { id: string; hidden: boolean }) => {
      const current = queryClient.getQueryData<string[]>(key) ?? [];
      const next = hidden ? [...new Set([...current, id])] : current.filter((t) => t !== id);
      queryClient.setQueryData(key, next);
      const { error } = await supabase
        .from('training_prefs')
        .upsert({ user_id: userId, hidden_training_type_ids: next }, { onConflict: 'user_id' });
      if (error) throw error;
    },
    onError: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

/** The training types I use: all minus the ones I hid. */
export function useTrainingTypes() {
  const all = useAllTrainingTypes();
  const hidden = useHiddenTrainingTypes().data ?? [];
  return { ...all, data: all.data?.filter((type) => !hidden.includes(type.id)) };
}

export function useCreateTrainingType() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      kind: TrainingType['kind'];
      withDistance: boolean;
      icon: string;
    }) => {
      const { error } = await supabase.from('training_types').insert({
        owner_id: userId,
        name: input.name.trim(),
        kind: input.kind,
        with_distance: input.kind === 'duration' && input.withDistance,
        icon: input.icon,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trainingKeys.types(userId) }),
  });
}

/** Edit or archive one of my own training types (kind stays as created). */
export function useUpdateTrainingType() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      name?: string;
      withDistance?: boolean;
      icon?: string;
      archived?: boolean;
    }) => {
      const { error } = await supabase
        .from('training_types')
        .update({
          ...(input.name !== undefined && { name: input.name.trim() }),
          ...(input.withDistance !== undefined && { with_distance: input.withDistance }),
          ...(input.icon !== undefined && { icon: input.icon }),
          ...(input.archived !== undefined && {
            archived_at: input.archived ? new Date().toISOString() : null,
          }),
        })
        .eq('id', input.id)
        .eq('owner_id', userId);
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: trainingKeys.types(userId) }),
  });
}

/** Search the shared catalogue by name or alias (empty query lists everything). */
export function useExerciseSearch(query: string, catalog: ExerciseCatalog = 'strength') {
  const userId = useUserId();
  const term = query.trim();
  return useQuery({
    queryKey: [...trainingKeys.search(userId, term.toLowerCase()), catalog],
    placeholderData: (previous) => previous,
    queryFn: async (): Promise<ExerciseSummary[]> => {
      const { data, error } = await supabase.rpc('search_exercises', {
        p_query: term,
        p_limit: 30,
        p_catalog: catalog,
      });
      if (error) throw error;
      return data.map((row) => ({
        id: row.id,
        name: row.name,
        measure: row.measure,
        matchedAlias: row.matched_alias,
      }));
    },
  });
}

export function useMuscleGroups() {
  return useQuery({
    queryKey: trainingKeys.muscles(),
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('muscle_groups')
        .select('key, label')
        .order('sort');
      if (error) throw error;
      return data;
    },
  });
}

export interface CreateExerciseInput {
  name: string;
  measure: ExerciseMeasure;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  /** Short how-to (optional). */
  instructions?: string | undefined;
  /** Mobility exercises live in their own catalogue. */
  catalog?: ExerciseCatalog | undefined;
}

/** Adds an exercise to the shared catalogue (name must be unique). */
export function useCreateExercise() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (input: CreateExerciseInput): Promise<ExerciseSummary> => {
      const id = crypto.randomUUID();
      const name = input.name.trim();
      const { error } = await supabase.from('exercises').insert({
        id,
        name,
        measure: input.measure,
        created_by: userId,
        catalog: input.catalog ?? 'strength',
        instructions: input.instructions?.trim() || null,
      });
      if (error) throw error;
      const muscles = [
        ...input.primaryMuscles.map((key) => ({
          exercise_id: id,
          muscle_group: key,
          role: 'primary',
        })),
        ...input.secondaryMuscles
          .filter((key) => !input.primaryMuscles.includes(key))
          .map((key) => ({ exercise_id: id, muscle_group: key, role: 'secondary' })),
      ];
      if (muscles.length > 0) {
        const { error: muscleError } = await supabase.from('exercise_muscles').insert(muscles);
        if (muscleError) throw muscleError;
      }
      return { id, name, measure: input.measure };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [...trainingKeys.all(userId), 'exercise-search'],
      });
      await queryClient.invalidateQueries({
        queryKey: [...trainingKeys.all(userId), 'primary-muscles'],
      });
    },
  });
}

export interface MuscleRef {
  key: string;
  label: string;
}

/**
 * Primary muscles of every exercise in the catalogue (small), for tile subtitles and the
 * training-focus filter. Exercises without muscles are missing from the map.
 */
export function usePrimaryMuscleIndex() {
  const userId = useUserId();
  const muscles = useMuscleGroups();
  const query = useQuery({
    queryKey: [...trainingKeys.all(userId), 'primary-muscles'],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercise_muscles')
        .select('exercise_id, muscle_group')
        .eq('role', 'primary');
      if (error) throw error;
      return data;
    },
  });
  const labels = new Map((muscles.data ?? []).map((m) => [m.key, m.label]));
  const byExercise = new Map<string, MuscleRef[]>();
  for (const row of query.data ?? []) {
    const list = byExercise.get(row.exercise_id) ?? [];
    list.push({ key: row.muscle_group, label: labels.get(row.muscle_group) ?? row.muscle_group });
    byExercise.set(row.exercise_id, list);
  }
  return byExercise;
}

/** Bucket with the catalogue illustrations (device types and exercises); public read. */
const CATALOG_BUCKET = 'catalog';

/** Public URL of a catalogue image path (image_path of a device type or exercise). */
export function catalogImageUrl(path: string | null | undefined): string | null {
  return path ? supabase.storage.from(CATALOG_BUCKET).getPublicUrl(path).data.publicUrl : null;
}

/** Image path of every exercise that has an illustration (small), keyed by exercise id. */
export function useExerciseImages() {
  const userId = useUserId();
  const query = useQuery({
    queryKey: [...trainingKeys.all(userId), 'exercise-images'],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercises')
        .select('id, image_path')
        .not('image_path', 'is', null);
      if (error) throw error;
      return data;
    },
  });
  return new Map((query.data ?? []).map((row) => [row.id, row.image_path]));
}

// ---------------------------------------------------------------------------
// Training focus (Push, Pull, Beine … and personal ones)
// ---------------------------------------------------------------------------
/** The focus's short name, or the first five characters of its name. */
export function shortNameOf(name: string, shortName: string | null): string {
  return shortName?.trim() ? shortName.trim() : name.slice(0, 5);
}

export function useTrainingFocuses() {
  const userId = useUserId();
  return useQuery({
    queryKey: [...trainingKeys.all(userId), 'focuses'],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<TrainingFocus[]> => {
      const { data, error } = await supabase
        .from('training_focuses')
        .select('id, name, short_name, muscle_groups, owner_id')
        .is('archived_at', null)
        .or(`owner_id.is.null,owner_id.eq.${userId}`)
        .order('sort')
        .order('name');
      if (error) throw error;
      return data.map((row) => ({
        id: row.id,
        name: row.name,
        shortName: shortNameOf(row.name, row.short_name),
        muscleGroups: row.muscle_groups,
        ownerId: row.owner_id,
      }));
    },
  });
}

export function useCreateTrainingFocus() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      shortName: string;
      muscleGroups: string[];
    }): Promise<string> => {
      const id = crypto.randomUUID();
      const { error } = await supabase.from('training_focuses').insert({
        id,
        owner_id: userId,
        name: input.name.trim(),
        short_name: input.shortName.trim() || null,
        muscle_groups: input.muscleGroups,
      });
      if (error) throw error;
      return id;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [...trainingKeys.all(userId), 'focuses'] }),
  });
}

/**
 * Whether an exercise fits a focus (any primary muscle in the focus). Exercises without
 * muscles always fit, so nothing silently disappears.
 */
export function fitsFocus(
  focus: TrainingFocus | null | undefined,
  muscles: MuscleRef[] | undefined,
): boolean {
  if (!focus || !muscles || muscles.length === 0) return true;
  return muscles.some((muscle) => focus.muscleGroups.includes(muscle.key));
}

export interface ExerciseHistory {
  lastDoneAt: string;
  lastWeightKg: number | null;
  lastReps: number | null;
  lastDurationSeconds: number | null;
  trend: TrendPoint[];
}

/**
 * My history for all exercises in one call, keyed "exerciseId:scope" where scope is the
 * machine id or "" (no device / comparable device). Use historyFor() to read it.
 */
export function useExerciseOverview() {
  const userId = useUserId();
  return useQuery({
    queryKey: [...trainingKeys.all(userId), 'overview'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Map<string, ExerciseHistory>> => {
      const { data, error } = await supabase.rpc('exercise_overview');
      if (error) throw error;
      const map = new Map<string, ExerciseHistory>();
      for (const row of data) {
        // Generated RPC types mark these as non-null, but they are null for the shared scope / no data.
        const scope = row.scope_device_id as string | null;
        const trend = row.trend as number[] | null;
        map.set(`${row.exercise_id}:${scope ?? ''}`, {
          lastDoneAt: row.last_done_at,
          lastWeightKg: row.last_weight_kg,
          lastReps: row.last_reps,
          lastDurationSeconds: row.last_duration_seconds,
          trend: (trend ?? []).map((value, index) => ({
            startedAt: String(index),
            value,
          })),
        });
      }
      return map;
    },
  });
}

/** History for an exercise in the scope of a device (machine) or the shared scope. */
export function historyFor(
  overview: Map<string, ExerciseHistory> | undefined,
  exerciseId: string,
  device: Pick<Device, 'id' | 'comparable'> | null,
): ExerciseHistory | undefined {
  if (!overview) return undefined;
  const scope = device && !device.comparable ? device.id : '';
  return overview.get(`${exerciseId}:${scope}`);
}

export interface MyExercise {
  exercise: ExerciseSummary;
  /** Most recent scope (machine or shared) and its history. */
  history: ExerciseHistory;
}

/** Every exercise I have done, most recently done first, with its latest history. */
export function useMyExercises() {
  const userId = useUserId();
  const overview = useExerciseOverview().data;
  const latest = new Map<string, ExerciseHistory>();
  for (const [key, history] of overview ?? []) {
    const exerciseId = key.slice(0, key.indexOf(':'));
    const known = latest.get(exerciseId);
    if (!known || history.lastDoneAt > known.lastDoneAt) latest.set(exerciseId, history);
  }
  const ids = [...latest.keys()].sort();
  const names = useQuery({
    queryKey: [...trainingKeys.all(userId), 'exercise-names', ids],
    enabled: ids.length > 0,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<ExerciseSummary[]> => {
      const { data, error } = await supabase
        .from('exercises')
        .select('id, name, measure')
        .in('id', ids);
      if (error) throw error;
      return data;
    },
  });
  const list: MyExercise[] = (names.data ?? []).flatMap((exercise) => {
    const history = latest.get(exercise.id);
    return history ? [{ exercise, history }] : [];
  });
  list.sort((a, b) => b.history.lastDoneAt.localeCompare(a.history.lastDoneAt));
  return { data: list, isPending: overview === undefined || (ids.length > 0 && names.isPending) };
}

export interface ExerciseDetails extends ExerciseSummary {
  instructions: string | null;
  catalog: ExerciseCatalog;
  createdBy: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
}

/** One exercise with everything its edit form needs. */
export function useExerciseDetails(exerciseId: string | null) {
  const userId = useUserId();
  return useQuery({
    queryKey: [...trainingKeys.all(userId), 'exercise', exerciseId],
    enabled: exerciseId !== null,
    queryFn: async (): Promise<ExerciseDetails | null> => {
      if (!exerciseId) return null;
      const { data, error } = await supabase
        .from('exercises')
        .select(
          'id, name, measure, instructions, catalog, created_by, exercise_muscles(muscle_group, role)',
        )
        .eq('id', exerciseId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const muscles = (role: string) =>
        data.exercise_muscles.filter((m) => m.role === role).map((m) => m.muscle_group);
      return {
        id: data.id,
        name: data.name,
        measure: data.measure,
        instructions: data.instructions,
        catalog: data.catalog === 'mobility' ? 'mobility' : 'strength',
        createdBy: data.created_by,
        primaryMuscles: muscles('primary'),
        secondaryMuscles: muscles('secondary'),
      };
    },
  });
}

export interface UpdateExerciseInput {
  id: string;
  name: string;
  instructions: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
}

/**
 * Edits an exercise of the shared catalogue (its creator or the super admin; the database
 * decides). The new name shows up everywhere, past workouts included.
 */
export function useUpdateExercise() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (input: UpdateExerciseInput) => {
      const { data, error } = await supabase
        .from('exercises')
        .update({ name: input.name.trim(), instructions: input.instructions.trim() || null })
        .eq('id', input.id)
        .select('id');
      if (error) throw error;
      if (data.length === 0) throw new Error('not_allowed');
      const { error: removeError } = await supabase
        .from('exercise_muscles')
        .delete()
        .eq('exercise_id', input.id);
      if (removeError) throw removeError;
      const muscles = [
        ...input.primaryMuscles.map((key) => ({
          exercise_id: input.id,
          muscle_group: key,
          role: 'primary',
        })),
        ...input.secondaryMuscles
          .filter((key) => !input.primaryMuscles.includes(key))
          .map((key) => ({ exercise_id: input.id, muscle_group: key, role: 'secondary' })),
      ];
      if (muscles.length > 0) {
        const { error: muscleError } = await supabase.from('exercise_muscles').insert(muscles);
        if (muscleError) throw muscleError;
      }
    },
    // Names show up in templates, workouts and history: refresh all training data.
    onSettled: () => queryClient.invalidateQueries({ queryKey: trainingKeys.all(userId) }),
  });
}
