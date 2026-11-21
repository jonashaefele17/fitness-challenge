import { queryOptions, useQuery } from '@tanstack/react-query';
import { useUserId } from '@/features/auth';
import { supabase } from '@/shared/lib/supabase';
import type { ExerciseRecords, ExerciseSession, SetValues } from '../types';
import { trainingKeys } from './keys';

export interface HistoryScope {
  exerciseId: string;
  /** The machine (own history) or null (no device / comparable devices). */
  deviceId: string | null;
  /** Ignore the device and show every workout of the exercise. */
  allDevices: boolean;
}

function scopeArgs(scope: HistoryScope) {
  return {
    p_exercise_id: scope.exerciseId,
    p_all_devices: scope.allDevices,
    ...(scope.deviceId && { p_device_id: scope.deviceId }),
  };
}

const num = (value: unknown): number | null =>
  value === null || value === undefined ? null : Number(value);

function toSetValues(raw: unknown): SetValues & { isWarmup: boolean } {
  const row = (raw ?? {}) as Record<string, unknown>;
  return {
    weightKg: num(row.weightKg),
    reps: num(row.reps),
    durationSeconds: num(row.durationSeconds),
    isWarmup: row.isWarmup === true,
  };
}

/**
 * Query options for the workouts with an exercise, newest first: mine, or another person's
 * (only returns what that person shares with me). Shared so comparison can load others.
 */
export function exerciseSessionsOptions(
  userId: string,
  scope: HistoryScope,
  personId: string | null = null,
) {
  return queryOptions({
    queryKey: [...trainingKeys.all(userId), 'sessions', scope, personId],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<ExerciseSession[]> => {
      const { data, error } = await supabase.rpc('exercise_sessions', {
        ...scopeArgs(scope),
        ...(personId && { p_user_id: personId }),
      });
      if (error) throw error;
      return data.map((row) => {
        // Generated RPC types mark these as non-null; they are null without a best set.
        const score = num(row.best_score);
        return {
          workoutId: row.workout_id,
          startedAt: row.started_at,
          locationName: row.location_name,
          deviceName: row.device_name,
          best:
            score === null
              ? null
              : {
                  weightKg: num(row.best_weight_kg),
                  reps: num(row.best_reps),
                  durationSeconds: num(row.best_duration_seconds),
                },
          score,
          volumeKg: num(row.volume_kg),
          sets: Array.isArray(row.sets) ? row.sets.map(toSetValues) : [],
        };
      });
    },
  });
}

/** My workouts with this exercise, newest first. */
export function useExerciseSessions(scope: HistoryScope) {
  return useQuery(exerciseSessionsOptions(useUserId(), scope));
}

export function useExerciseRecords(scope: HistoryScope) {
  const userId = useUserId();
  return useQuery({
    queryKey: [...trainingKeys.all(userId), 'records', scope],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<ExerciseRecords> => {
      const { data, error } = await supabase.rpc('exercise_records', scopeArgs(scope));
      if (error) throw error;
      const records: ExerciseRecords = {
        best: null,
        heaviest: null,
        volume: null,
        repsAtWeight: [],
      };
      for (const row of data) {
        const set = {
          weightKg: num(row.weight_kg),
          reps: num(row.reps),
          durationSeconds: num(row.duration_seconds),
          achievedAt: row.achieved_at,
        };
        if (row.kind === 'best') records.best = set;
        else if (row.kind === 'heaviest') records.heaviest = set;
        else if (row.kind === 'volume')
          records.volume = { volumeKg: row.value, achievedAt: row.achieved_at };
        else if (set.weightKg !== null && set.reps !== null)
          records.repsAtWeight.push({
            weightKg: set.weightKg,
            reps: set.reps,
            achievedAt: row.achieved_at,
          });
      }
      records.repsAtWeight.sort((a, b) => b.weightKg - a.weightKg);
      return records;
    },
  });
}
