import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUserId } from '@/features/auth';
import { supabase } from '@/shared/lib/supabase';
import type { Device, ExerciseMeasure, ExerciseSummary, TrainingType, TrendPoint } from '../types';
import { trainingKeys } from './keys';

export function useTrainingTypes() {
  const userId = useUserId();
  return useQuery({
    queryKey: trainingKeys.types(userId),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<TrainingType[]> => {
      const { data, error } = await supabase
        .from('training_types')
        .select('id, name, kind, with_distance, owner_id, location_mode, variants')
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
      }));
    },
  });
}

export function useCreateTrainingType() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      kind: TrainingType['kind'];
      withDistance: boolean;
    }) => {
      const { error } = await supabase.from('training_types').insert({
        owner_id: userId,
        name: input.name.trim(),
        kind: input.kind,
        with_distance: input.kind === 'duration' && input.withDistance,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trainingKeys.types(userId) }),
  });
}

/** Search the shared catalogue by name or alias (empty query lists everything). */
export function useExerciseSearch(query: string) {
  const userId = useUserId();
  const term = query.trim();
  return useQuery({
    queryKey: trainingKeys.search(userId, term.toLowerCase()),
    placeholderData: (previous) => previous,
    queryFn: async (): Promise<ExerciseSummary[]> => {
      const { data, error } = await supabase.rpc('search_exercises', {
        p_query: term,
        p_limit: 30,
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
}

/** Adds an exercise to the shared catalogue (name must be unique). */
export function useCreateExercise() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (input: CreateExerciseInput): Promise<ExerciseSummary> => {
      const id = crypto.randomUUID();
      const name = input.name.trim();
      const { error } = await supabase
        .from('exercises')
        .insert({ id, name, measure: input.measure, created_by: userId });
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
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [...trainingKeys.all(userId), 'exercise-search'] }),
  });
}

/** Primary muscle labels per exercise, for tiles ("Brust · Trizeps"). */
export function usePrimaryMuscles(exerciseIds: string[]) {
  const userId = useUserId();
  const muscles = useMuscleGroups();
  const ids = [...exerciseIds].sort();
  const query = useQuery({
    queryKey: [...trainingKeys.all(userId), 'primary-muscles', ids],
    enabled: ids.length > 0,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercise_muscles')
        .select('exercise_id, muscle_group')
        .in('exercise_id', ids)
        .eq('role', 'primary');
      if (error) throw error;
      return data;
    },
  });
  const labels = new Map((muscles.data ?? []).map((m) => [m.key, m.label]));
  const byExercise = new Map<string, string[]>();
  for (const row of query.data ?? []) {
    const list = byExercise.get(row.exercise_id) ?? [];
    list.push(labels.get(row.muscle_group) ?? row.muscle_group);
    byExercise.set(row.exercise_id, list);
  }
  return byExercise;
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
