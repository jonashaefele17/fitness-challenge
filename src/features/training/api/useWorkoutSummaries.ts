import { useQuery } from '@tanstack/react-query';
import { useUserId } from '@/features/auth';
import { supabase } from '@/shared/lib/supabase';
import type { WorkoutCardSummary } from '../types';
import { trainingKeys } from './keys';

/** Card numbers of finished workouts I may see, in the order asked for. */
export function useWorkoutSummaries(workoutIds: string[]) {
  const userId = useUserId();
  const ids = [...workoutIds].sort();
  return useQuery({
    queryKey: [...trainingKeys.all(userId), 'summaries', ...ids],
    enabled: ids.length > 0,
    queryFn: async (): Promise<WorkoutCardSummary[]> => {
      const { data, error } = await supabase.rpc('workout_summaries', { p_workout_ids: ids });
      if (error) throw error;
      const byId = new Map(
        data.map((row) => [
          row.id,
          {
            id: row.id,
            userId: row.user_id,
            trainingType: {
              id: row.training_type_id,
              name: row.type_name,
              icon: row.type_icon,
              kind: row.type_kind === 'duration' ? 'duration' : 'exercises',
              guided: row.guided,
            },
            focusName: row.focus_name,
            variant: row.variant,
            locationName: row.location_name,
            startedAt: row.started_at,
            durationSeconds: row.duration_seconds,
            distanceM: row.distance_m,
            exerciseCount: row.exercise_count,
            workingSets: row.working_sets,
            volumeKg: row.volume_kg,
            exerciseNames: row.exercise_names,
            recordCount: row.record_count,
          } satisfies WorkoutCardSummary,
        ]),
      );
      return workoutIds.flatMap((id) => byId.get(id) ?? []);
    },
  });
}
