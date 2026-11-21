import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUserId } from '@/features/auth';
import { supabase } from '@/shared/lib/supabase';
import type { CalendarWorkout, WorkoutDetailData, WorkoutItem, WorkoutSet } from '../types';
import { shortNameOf } from './useCatalog';
import { DEVICE_COLUMNS, toDevice } from './deviceRow';
import { trainingKeys } from './keys';

const SUMMARY_COLUMNS = `
  id, user_id, started_at, ended_at, paused_seconds, duration_seconds, distance_m, variant,
  training_types!inner(id, name, kind, icon),
  training_focuses(id, name, short_name),
  locations(name),
  workout_items(id)
`;

interface SummaryRow {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  paused_seconds: number;
  duration_seconds: number | null;
  distance_m: number | null;
  variant: string | null;
  training_types: { id: string; name: string; kind: string; icon: string };
  training_focuses: { id: string; name: string; short_name: string | null } | null;
  locations: { name: string } | null;
  workout_items: { id: string }[];
}

function toCalendarWorkout(row: SummaryRow): CalendarWorkout {
  const measured =
    row.ended_at === null
      ? null
      : Math.max(
          0,
          Math.round(
            (new Date(row.ended_at).getTime() - new Date(row.started_at).getTime()) / 1000,
          ) - row.paused_seconds,
        );
  return {
    id: row.id,
    userId: row.user_id,
    startedAt: row.started_at,
    durationSeconds: row.duration_seconds ?? measured,
    trainingType: {
      id: row.training_types.id,
      name: row.training_types.name,
      kind: row.training_types.kind === 'duration' ? 'duration' : 'exercises',
      icon: row.training_types.icon,
    },
    variant: row.variant,
    focus: row.training_focuses && {
      id: row.training_focuses.id,
      name: row.training_focuses.name,
      shortName: shortNameOf(row.training_focuses.name, row.training_focuses.short_name),
    },
    locationName: row.locations?.name ?? null,
    distanceM: row.distance_m,
    exerciseCount: row.workout_items.length,
  };
}

/**
 * Finished workouts in [from, to): mine, or another person's (only what they share with me).
 * Shared as options so the social calendar view can load others the same way.
 */
export function workoutsInRangeOptions(
  userId: string,
  range: { from: Date; to: Date },
  personId: string | null = null,
) {
  const from = range.from.toISOString();
  const to = range.to.toISOString();
  return queryOptions({
    queryKey: [...trainingKeys.all(userId), 'calendar', from, to, personId],
    staleTime: 60_000,
    queryFn: async (): Promise<CalendarWorkout[]> => {
      const { data, error } = await supabase
        .from('workouts')
        .select(SUMMARY_COLUMNS)
        .eq('user_id', personId ?? userId)
        .eq('status', 'finished')
        .gte('started_at', from)
        .lt('started_at', to)
        .order('started_at');
      if (error) throw error;
      return data.map(toCalendarWorkout);
    },
  });
}

export function useWorkoutsInRange(range: { from: Date; to: Date }) {
  return useQuery(workoutsInRangeOptions(useUserId(), range));
}

const num = (value: number | string | null): number | null =>
  value === null ? null : Number(value);

/** One finished workout with exercises and sets (mine or shared with me). */
export function useWorkoutDetail(workoutId: string | null) {
  const userId = useUserId();
  return useQuery({
    queryKey: [...trainingKeys.all(userId), 'workout', workoutId],
    enabled: workoutId !== null,
    queryFn: async (): Promise<WorkoutDetailData | null> => {
      if (!workoutId) return null;
      const { data, error } = await supabase
        .from('workouts')
        .select(
          `${SUMMARY_COLUMNS}, intensity, note, template_id,
           items:workout_items(
             id, position, note,
             exercises!inner(id, name, measure),
             devices(${DEVICE_COLUMNS}),
             workout_sets(id, position, weight_kg, reps, duration_seconds, is_warmup, completed_at)
           )`,
        )
        .eq('id', workoutId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...toCalendarWorkout(data),
        endedAt: data.ended_at,
        intensity: data.intensity,
        note: data.note,
        templateId: data.template_id,
        items: data.items
          .map((item): WorkoutItem => ({
            id: item.id,
            position: item.position,
            note: item.note,
            device: item.devices ? toDevice(item.devices) : null,
            exercise: {
              id: item.exercises.id,
              name: item.exercises.name,
              measure: item.exercises.measure,
            },
            sets: item.workout_sets
              .filter((set) => set.completed_at !== null)
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
          .filter((item) => item.sets.length > 0)
          .sort((a, b) => a.position - b.position),
      };
    },
  });
}

/** Set or change the focus of a finished workout of mine (e.g. "Push"). */
export function useSetFinishedWorkoutFocus(workoutId: string) {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (focusId: string | null) => {
      const { error } = await supabase
        .from('workouts')
        .update({ focus_id: focusId })
        .eq('id', workoutId);
      if (error) throw error;
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === 'training' &&
          query.queryKey[1] === userId &&
          (query.queryKey[2] === 'calendar' || query.queryKey[2] === 'workout'),
      }),
  });
}
