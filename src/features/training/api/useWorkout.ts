import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUserId } from '@/features/auth';
import { showToast } from '@/shared/lib';
import { supabase } from '@/shared/lib/supabase';
import type {
  ActiveWorkout,
  Device,
  DurationEntryInput,
  ExerciseSummary,
  PreviousSet,
  TrendPoint,
  WorkoutItem,
  WorkoutSet,
} from '../types';
import { trainingKeys } from './keys';

const ACTIVE_SELECT = `
  id, user_id, started_at, paused_at, paused_seconds,
  training_types!inner(id, name, kind),
  locations(id, name, owner_id),
  workout_items(
    id, position, note,
    exercises!inner(id, name, measure),
    devices(id, name, weight_step, comparable, setting_fields),
    workout_sets(id, position, weight_kg, reps, duration_seconds, is_warmup, completed_at)
  )
`;

/**
 * All writes to the running workout share one queue, so they reach the server in order
 * (e.g. a new set never races ahead of the exercise it belongs to). The UI still updates
 * immediately (optimistic).
 */
const WORKOUT_SCOPE = { id: 'active-workout' } as const;

const num = (value: number | string | null): number | null =>
  value === null ? null : Number(value);

/** My running workout with exercises and sets, or null. */
export function useActiveWorkout() {
  const userId = useUserId();
  return useQuery({
    queryKey: trainingKeys.active(userId),
    queryFn: async (): Promise<ActiveWorkout | null> => {
      const { data, error } = await supabase
        .from('workouts')
        .select(ACTIVE_SELECT)
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        startedAt: data.started_at,
        pausedAt: data.paused_at,
        pausedSeconds: data.paused_seconds,
        location: data.locations
          ? {
              id: data.locations.id,
              name: data.locations.name,
              private: data.locations.owner_id === data.user_id,
            }
          : null,
        trainingType: {
          id: data.training_types.id,
          name: data.training_types.name,
          kind: data.training_types.kind === 'duration' ? 'duration' : 'exercises',
        },
        items: data.workout_items
          .map((item): WorkoutItem => ({
            id: item.id,
            position: item.position,
            note: item.note,
            device: item.devices
              ? {
                  id: item.devices.id,
                  name: item.devices.name,
                  weightStep: num(item.devices.weight_step),
                  comparable: item.devices.comparable,
                  settingFields: item.devices.setting_fields,
                }
              : null,
            exercise: {
              id: item.exercises.id,
              name: item.exercises.name,
              measure: item.exercises.measure,
            },
            sets: item.workout_sets
              .map((set): WorkoutSet => ({
                id: set.id,
                position: set.position,
                weightKg: num(set.weight_kg),
                reps: set.reps,
                durationSeconds: set.duration_seconds,
                isWarmup: set.is_warmup,
                completedAt: set.completed_at,
              }))
              .sort((a, b) => a.position - b.position),
          }))
          .sort((a, b) => a.position - b.position),
      };
    },
  });
}

/** Optimistic edits of the cached running workout with rollback on error. */
function useActiveMutation<TInput>(
  mutationFn: (input: TInput) => Promise<unknown>,
  apply: (workout: ActiveWorkout, input: TInput) => ActiveWorkout,
  { refetch = false }: { refetch?: boolean } = {},
) {
  const queryClient = useQueryClient();
  const key = trainingKeys.active(useUserId());
  return useMutation({
    mutationFn,
    scope: WORKOUT_SCOPE,
    onMutate: async (input: TInput) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ActiveWorkout | null>(key);
      if (previous) queryClient.setQueryData(key, apply(previous, input));
      return { previous };
    },
    onError: (error, _input, context) => {
      queryClient.setQueryData(key, context?.previous);
      // Never fail silently: tell the user and resync with the server.
      console.error('Saving the workout failed', error);
      showToast('Konnte nicht gespeichert werden – bitte nochmal.');
      void queryClient.invalidateQueries({ queryKey: key });
    },
    onSettled: () => (refetch ? queryClient.invalidateQueries({ queryKey: key }) : undefined),
  });
}

const mapItem = (
  workout: ActiveWorkout,
  itemId: string,
  fn: (item: WorkoutItem) => WorkoutItem,
): ActiveWorkout => ({
  ...workout,
  items: workout.items.map((item) => (item.id === itemId ? fn(item) : item)),
});

// ---------------------------------------------------------------------------
// Start, finish, discard, pause
// ---------------------------------------------------------------------------
export function useStartWorkout() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async ({ trainingTypeId }: { trainingTypeId: string }) => {
      const { error } = await supabase.rpc('start_workout', { p_training_type_id: trainingTypeId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trainingKeys.active(userId) }),
  });
}

/** Light entry: one tap "Training erledigt" with duration (± distance, intensity, note). */
export function useLogDurationEntry() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (input: DurationEntryInput) => {
      const { data, error } = await supabase.rpc('start_workout', {
        p_training_type_id: input.trainingTypeId,
      });
      if (error) throw error;
      const { error: updateError } = await supabase
        .from('workouts')
        .update({
          duration_seconds: Math.round(input.durationMinutes * 60),
          distance_m: input.distanceKm !== undefined ? Math.round(input.distanceKm * 1000) : null,
          intensity: input.intensity ?? null,
          note: input.note?.trim() ? input.note.trim() : null,
          variant: input.variant ?? null,
        })
        .eq('id', data.id);
      if (updateError) throw updateError;
      const { error: finishError } = await supabase.rpc('finish_workout', {
        p_workout_id: data.id,
      });
      if (finishError) throw finishError;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: trainingKeys.all(userId) }),
  });
}

export interface FinishedWorkout {
  id: string;
  startedAt: string;
  endedAt: string;
  pausedSeconds: number;
}

export function useFinishWorkout() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    scope: WORKOUT_SCOPE,
    mutationFn: async (workoutId: string): Promise<FinishedWorkout> => {
      const { data, error } = await supabase.rpc('finish_workout', { p_workout_id: workoutId });
      if (error) throw error;
      return {
        id: data.id,
        startedAt: data.started_at,
        endedAt: data.ended_at ?? data.started_at,
        pausedSeconds: data.paused_seconds,
      };
    },
    onSuccess: () => {
      queryClient.setQueryData(trainingKeys.active(userId), null);
      void queryClient.invalidateQueries({ queryKey: trainingKeys.all(userId) });
    },
  });
}

export function useDiscardWorkout() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    scope: WORKOUT_SCOPE,
    mutationFn: async (workoutId: string) => {
      const { error } = await supabase.from('workouts').delete().eq('id', workoutId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.setQueryData(trainingKeys.active(userId), null);
    },
  });
}

export function useTogglePause() {
  return useActiveMutation(
    async (workout: ActiveWorkout) => {
      const now = new Date();
      const changes = workout.pausedAt
        ? {
            paused_at: null,
            paused_seconds:
              workout.pausedSeconds +
              Math.round((now.getTime() - new Date(workout.pausedAt).getTime()) / 1000),
          }
        : { paused_at: now.toISOString() };
      const { error } = await supabase.from('workouts').update(changes).eq('id', workout.id);
      if (error) throw error;
    },
    (workout) =>
      workout.pausedAt
        ? {
            ...workout,
            pausedAt: null,
            pausedSeconds:
              workout.pausedSeconds +
              Math.round((Date.now() - new Date(workout.pausedAt).getTime()) / 1000),
          }
        : { ...workout, pausedAt: new Date().toISOString() },
  );
}

// ---------------------------------------------------------------------------
// Exercises in the workout
// ---------------------------------------------------------------------------
async function savePositions(items: WorkoutItem[]) {
  const results = await Promise.all(
    items.map((item, position) =>
      supabase.from('workout_items').update({ position }).eq('id', item.id),
    ),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
}

/** Inserts an exercise right after the given item (or at the end) with one empty set. */
export function useAddExercise(workoutId: string) {
  return useActiveMutation(
    async ({
      itemId,
      setId,
      exercise,
      device,
      afterItemId,
      items,
    }: {
      itemId: string;
      setId: string;
      exercise: ExerciseSummary;
      device: Device | null;
      afterItemId: string | null;
      items: WorkoutItem[];
    }) => {
      const index = afterItemId
        ? items.findIndex((item) => item.id === afterItemId) + 1
        : items.length;
      const { error } = await supabase.from('workout_items').insert({
        id: itemId,
        workout_id: workoutId,
        exercise_id: exercise.id,
        device_id: device?.id ?? null,
        position: index,
      });
      if (error) throw error;
      const { error: setError } = await supabase
        .from('workout_sets')
        .insert({ id: setId, item_id: itemId, position: 0 });
      if (setError) throw setError;
      const reordered = [...items];
      reordered.splice(index, 0, { id: itemId } as WorkoutItem);
      await savePositions(reordered);
    },
    (workout, { itemId, setId, exercise, device, afterItemId }) => {
      const index = afterItemId
        ? workout.items.findIndex((item) => item.id === afterItemId) + 1
        : workout.items.length;
      const items = [...workout.items];
      items.splice(index, 0, {
        id: itemId,
        position: index,
        note: null,
        device,
        exercise,
        sets: [
          {
            id: setId,
            position: 0,
            weightKg: null,
            reps: null,
            durationSeconds: null,
            isWarmup: false,
            completedAt: null,
          },
        ],
      });
      return { ...workout, items: items.map((item, position) => ({ ...item, position })) };
    },
  );
}

export function useReorderItems() {
  return useActiveMutation(
    async (items: WorkoutItem[]) => savePositions(items),
    (workout, items) => ({
      ...workout,
      items: items.map((item, position) => ({ ...item, position })),
    }),
  );
}

export function useRemoveItem() {
  return useActiveMutation(
    async (itemId: string) => {
      const { error } = await supabase.from('workout_items').delete().eq('id', itemId);
      if (error) throw error;
    },
    (workout, itemId) => ({
      ...workout,
      items: workout.items.filter((item) => item.id !== itemId),
    }),
  );
}

export function useSwapExercise() {
  return useActiveMutation(
    async ({ itemId, exercise }: { itemId: string; exercise: ExerciseSummary }) => {
      const { error } = await supabase
        .from('workout_items')
        .update({ exercise_id: exercise.id })
        .eq('id', itemId);
      if (error) throw error;
    },
    (workout, { itemId, exercise }) => mapItem(workout, itemId, (item) => ({ ...item, exercise })),
  );
}

export function useUpdateItemNote() {
  return useActiveMutation(
    async ({ itemId, note }: { itemId: string; note: string }) => {
      const { error } = await supabase
        .from('workout_items')
        .update({ note: note.trim() || null })
        .eq('id', itemId);
      if (error) throw error;
    },
    (workout, { itemId, note }) =>
      mapItem(workout, itemId, (item) => ({ ...item, note: note.trim() || null })),
  );
}

// ---------------------------------------------------------------------------
// Sets (each change is saved immediately)
// ---------------------------------------------------------------------------
export function useAddSet() {
  return useActiveMutation(
    async ({ itemId, set }: { itemId: string; set: WorkoutSet }) => {
      const { error } = await supabase.from('workout_sets').insert({
        id: set.id,
        item_id: itemId,
        position: set.position,
        weight_kg: set.weightKg,
        reps: set.reps,
        duration_seconds: set.durationSeconds,
        is_warmup: set.isWarmup,
        completed_at: set.completedAt,
      });
      if (error) throw error;
    },
    (workout, { itemId, set }) =>
      mapItem(workout, itemId, (item) => ({
        ...item,
        sets: [...item.sets, set].sort((a, b) => a.position - b.position),
      })),
  );
}

export type SetChanges = Partial<
  Pick<WorkoutSet, 'weightKg' | 'reps' | 'durationSeconds' | 'isWarmup' | 'completedAt'>
>;

export function useUpdateSet() {
  return useActiveMutation(
    async ({ setId, changes }: { itemId: string; setId: string; changes: SetChanges }) => {
      const { error } = await supabase
        .from('workout_sets')
        .update({
          ...(changes.weightKg !== undefined && { weight_kg: changes.weightKg }),
          ...(changes.reps !== undefined && { reps: changes.reps }),
          ...(changes.durationSeconds !== undefined && {
            duration_seconds: changes.durationSeconds,
          }),
          ...(changes.isWarmup !== undefined && { is_warmup: changes.isWarmup }),
          ...(changes.completedAt !== undefined && { completed_at: changes.completedAt }),
        })
        .eq('id', setId);
      if (error) throw error;
    },
    (workout, { itemId, setId, changes }) =>
      mapItem(workout, itemId, (item) => ({
        ...item,
        sets: item.sets.map((set) => (set.id === setId ? { ...set, ...changes } : set)),
      })),
  );
}

export function useDeleteSet() {
  return useActiveMutation(
    async ({ setId }: { itemId: string; setId: string }) => {
      const { error } = await supabase.from('workout_sets').delete().eq('id', setId);
      if (error) throw error;
    },
    (workout, { itemId, setId }) =>
      mapItem(workout, itemId, (item) => ({
        ...item,
        sets: item.sets.filter((set) => set.id !== setId),
      })),
  );
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------
export function usePreviousSets(exerciseId: string, deviceId: string | null) {
  const userId = useUserId();
  return useQuery({
    queryKey: [...trainingKeys.previous(userId, exerciseId), deviceId],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<PreviousSet[]> => {
      const { data, error } = await supabase.rpc('previous_sets', {
        p_exercise_id: exerciseId,
        ...(deviceId && { p_device_id: deviceId }),
      });
      if (error) throw error;
      return data.map((row) => ({
        position: row.set_position,
        weightKg: num(row.weight_kg),
        reps: row.reps,
        durationSeconds: row.duration_seconds,
        isWarmup: row.is_warmup,
        sameDevice: row.same_device,
      }));
    },
  });
}

export function useExerciseTrend(exerciseId: string, deviceId: string | null) {
  const userId = useUserId();
  return useQuery({
    queryKey: [...trainingKeys.trend(userId, exerciseId), deviceId],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<TrendPoint[]> => {
      const { data, error } = await supabase.rpc('exercise_trend', {
        p_exercise_id: exerciseId,
        p_limit: 6,
        ...(deviceId && { p_device_id: deviceId }),
      });
      if (error) throw error;
      return data.map((row) => ({ startedAt: row.workout_started_at, value: row.value }));
    },
  });
}

/** Undo for removing an exercise: puts the item and its sets back where they were. */
export function useRestoreItem(workoutId: string) {
  return useActiveMutation(
    async ({ item, items }: { item: WorkoutItem; items: WorkoutItem[] }) => {
      const { error } = await supabase.from('workout_items').insert({
        id: item.id,
        workout_id: workoutId,
        exercise_id: item.exercise.id,
        device_id: item.device?.id ?? null,
        position: item.position,
        note: item.note,
      });
      if (error) throw error;
      if (item.sets.length > 0) {
        const { error: setError } = await supabase.from('workout_sets').insert(
          item.sets.map((set) => ({
            id: set.id,
            item_id: item.id,
            position: set.position,
            weight_kg: set.weightKg,
            reps: set.reps,
            duration_seconds: set.durationSeconds,
            is_warmup: set.isWarmup,
            completed_at: set.completedAt,
          })),
        );
        if (setError) throw setError;
      }
      const restored = [...items.filter((other) => other.id !== item.id)];
      restored.splice(item.position, 0, item);
      await savePositions(restored);
    },
    (workout, { item }) => {
      const items = workout.items.filter((other) => other.id !== item.id);
      items.splice(item.position, 0, item);
      return { ...workout, items: items.map((other, position) => ({ ...other, position })) };
    },
  );
}

/** Change where the running workout happens (null: on the road). */
export function useSetWorkoutLocation(workoutId: string) {
  return useActiveMutation(
    async (place: ActiveWorkout['location']) => {
      const { error } = await supabase
        .from('workouts')
        .update({ location_id: place?.id ?? null })
        .eq('id', workoutId);
      if (error) throw error;
    },
    (workout, place) => ({ ...workout, location: place }),
  );
}

/** Choose (or clear) the device for an exercise in the running workout. */
export function useSetItemDevice() {
  return useActiveMutation(
    async ({ itemId, device }: { itemId: string; device: Device | null }) => {
      const { error } = await supabase
        .from('workout_items')
        .update({ device_id: device?.id ?? null })
        .eq('id', itemId);
      if (error) throw error;
    },
    (workout, { itemId, device }) => mapItem(workout, itemId, (item) => ({ ...item, device })),
  );
}
