import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useUserId } from '@/features/auth';
import { supabase } from '@/shared/lib/supabase';
import type { TemplateDraft, TemplateItem, TemplateSummary } from '../types';
import { trainingKeys } from './keys';

const templateKeys = {
  all: (userId: string) => [...trainingKeys.all(userId), 'templates'] as const,
  items: (userId: string, id: string) => [...templateKeys.all(userId), 'items', id] as const,
};

/** Every template I can use, with usage (computed on the server). */
export function useTemplates() {
  const userId = useUserId();
  return useQuery({
    queryKey: templateKeys.all(userId),
    staleTime: 60_000,
    queryFn: async (): Promise<TemplateSummary[]> => {
      const { data, error } = await supabase.rpc('template_overview');
      if (error) throw error;
      return data.map((row) => ({
        id: row.id,
        ownerId: row.user_id,
        ownerName: row.owner_name,
        mine: row.user_id === userId,
        name: row.name,
        trainingTypeId: row.training_type_id,
        focusId: row.focus_id,
        note: row.note,
        archivedAt: row.archived_at,
        exerciseCount: row.exercise_count,
        myLastUsedAt: row.my_last_used_at,
        ownerLastUsedAt: row.owner_last_used_at,
      }));
    },
  });
}

/** A template's exercises in order. */
export function useTemplateItems(templateId: string | null) {
  const userId = useUserId();
  return useQuery({
    queryKey: templateKeys.items(userId, templateId ?? 'none'),
    enabled: templateId !== null,
    queryFn: async (): Promise<TemplateItem[]> => {
      if (!templateId) return [];
      const { data, error } = await supabase
        .from('workout_template_items')
        .select(
          'position, sets, warmup_sets, rep_min, rep_max, duration_seconds, note, rest_seconds, per_side, side_rest_seconds, exercises!inner(id, name, measure, instructions), device_types(id, name)',
        )
        .eq('template_id', templateId)
        .order('position');
      if (error) throw error;
      return data.map((row) => ({
        exercise: {
          id: row.exercises.id,
          name: row.exercises.name,
          measure: row.exercises.measure,
          instructions: row.exercises.instructions,
        },
        deviceType: row.device_types,
        sets: row.sets,
        warmupSets: row.warmup_sets,
        repMin: row.rep_min,
        repMax: row.rep_max,
        durationSeconds: row.duration_seconds,
        note: row.note,
        restSeconds: row.rest_seconds,
        perSide: row.per_side,
        sideRestSeconds: row.side_rest_seconds,
      }));
    },
  });
}

function invalidate(queryClient: QueryClient, userId: string) {
  return queryClient.invalidateQueries({ queryKey: templateKeys.all(userId) });
}

export function useSaveTemplate() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (draft: TemplateDraft): Promise<string> => {
      const { data, error } = await supabase.rpc('save_template', {
        // The generated types do not know these parameters may be null.
        p_template_id: draft.id as string,
        p_name: draft.name.trim(),
        p_training_type_id: draft.trainingTypeId,
        p_focus_id: draft.focusId as string,
        p_note: draft.note,
        p_items: draft.items.map((item) => ({
          exerciseId: item.exercise.id,
          deviceTypeId: item.deviceType?.id ?? null,
          sets: item.sets,
          warmupSets: item.warmupSets,
          repMin: item.repMin,
          repMax: item.repMax,
          durationSeconds: item.durationSeconds,
          note: item.note,
          restSeconds: item.restSeconds,
          perSide: item.perSide,
          sideRestSeconds: item.sideRestSeconds,
        })),
      });
      if (error) throw error;
      return data;
    },
    onSettled: () => invalidate(queryClient, userId),
  });
}

/** Save a finished workout of mine as a new template, or replace one of mine with it. */
export function useTemplateFromWorkout() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (input: {
      workoutId: string;
      name: string;
      templateId?: string | undefined;
    }): Promise<string> => {
      const { data, error } = await supabase.rpc('template_from_workout', {
        p_workout_id: input.workoutId,
        p_name: input.name.trim(),
        ...(input.templateId && { p_template_id: input.templateId }),
      });
      if (error) throw error;
      return data;
    },
    onSettled: () => invalidate(queryClient, userId),
  });
}

export function useCopyTemplate() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (templateId: string): Promise<string> => {
      const { data, error } = await supabase.rpc('copy_template', { p_template_id: templateId });
      if (error) throw error;
      return data;
    },
    onSettled: () => invalidate(queryClient, userId),
  });
}

/** Archive (hide) or restore a template of mine. */
export function useArchiveTemplate() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await supabase
        .from('workout_templates')
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .eq('id', id);
      if (error) throw error;
    },
    onSettled: () => invalidate(queryClient, userId),
  });
}

/** Delete a template of mine for good; workouts keep everything but the link. */
export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('workout_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSettled: () => invalidate(queryClient, userId),
  });
}

/** Exercise order of each of the given templates (to spot near-duplicates). */
export function useTemplateExerciseLists(templateIds: string[]) {
  const userId = useUserId();
  const ids = [...templateIds].sort();
  return useQuery({
    queryKey: [...templateKeys.all(userId), 'exercise-lists', ids],
    enabled: ids.length > 0,
    queryFn: async (): Promise<{ id: string; exerciseIds: string[] }[]> => {
      const { data, error } = await supabase
        .from('workout_template_items')
        .select('template_id, exercise_id, position')
        .in('template_id', ids)
        .order('position');
      if (error) throw error;
      const lists = new Map<string, string[]>();
      for (const row of data) {
        lists.set(row.template_id, [...(lists.get(row.template_id) ?? []), row.exercise_id]);
      }
      return [...lists].map(([id, exerciseIds]) => ({ id, exerciseIds }));
    },
  });
}
