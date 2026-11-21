import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUserId } from '@/features/auth';
import { supabase } from '@/shared/lib/supabase';
import type { ExerciseMeasure, ExerciseSummary, TrainingType } from '../types';
import { trainingKeys } from './keys';

export function useTrainingTypes() {
  const userId = useUserId();
  return useQuery({
    queryKey: trainingKeys.types(userId),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<TrainingType[]> => {
      const { data, error } = await supabase
        .from('training_types')
        .select('id, name, kind, with_distance, owner_id')
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
