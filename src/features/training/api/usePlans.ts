import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUserId } from '@/features/auth';
import { supabase } from '@/shared/lib/supabase';
import { dayKey } from '../calendar';
import type { PlanDraft, PlanOccurrence } from '../types';
import { trainingKeys } from './keys';

const planKeys = {
  all: (userId: string) => [...trainingKeys.all(userId), 'plans'] as const,
};

/** Dates of a person's plans in a range (mine by default); usable from slots too. */
export function planOccurrencesOptions(
  userId: string,
  range: { from: Date; to: Date },
  personId?: string,
) {
  const from = dayKey(range.from);
  const to = dayKey(range.to);
  return {
    queryKey: [...planKeys.all(userId), personId ?? userId, from, to] as const,
    queryFn: async (): Promise<PlanOccurrence[]> => {
      const { data, error } = await supabase.rpc('plan_occurrences', {
        p_user_id: personId ?? userId,
        p_from: from,
        p_to: to,
      });
      if (error) throw error;
      return data.map((row) => ({
        planId: row.plan_id,
        userId: row.user_id,
        onDate: row.on_date,
        startTime: row.start_time ? row.start_time.slice(0, 5) : null,
        kind: row.kind === 'event' ? 'event' : 'training',
        trainingType: row.training_type_id
          ? { id: row.training_type_id, name: row.type_name, icon: row.type_icon }
          : null,
        templateId: row.template_id,
        title: row.title,
        note: row.note,
        recurring: row.recurring,
        status:
          row.status === 'done' ? 'done' : row.status === 'cancelled' ? 'cancelled' : 'planned',
        workoutId: row.workout_id,
      }));
    },
  };
}

export function usePlanOccurrences(range: { from: Date; to: Date }) {
  return useQuery(planOccurrencesOptions(useUserId(), range));
}

/** A plan for editing. */
export function usePlan(planId: string | null) {
  const userId = useUserId();
  return useQuery({
    queryKey: [...planKeys.all(userId), 'plan', planId],
    enabled: planId !== null,
    queryFn: async (): Promise<PlanDraft | null> => {
      if (!planId) return null;
      const { data, error } = await supabase
        .from('plans')
        .select(
          'id, kind, training_type_id, template_id, title, note, starts_on, start_time, repeat_weekdays, repeat_until',
        )
        .eq('id', planId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        kind: data.kind === 'event' ? 'event' : 'training',
        trainingTypeId: data.training_type_id,
        templateId: data.template_id,
        title: data.title ?? '',
        note: data.note ?? '',
        startsOn: data.starts_on,
        startTime: data.start_time ? data.start_time.slice(0, 5) : '',
        repeatWeekdays: data.repeat_weekdays,
        repeatUntil: data.repeat_until ?? '',
      };
    },
  });
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>, userId: string) {
  return queryClient.invalidateQueries({ queryKey: planKeys.all(userId) });
}

/** Creates or updates a plan (a series is changed as a whole). */
export function useSavePlan() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (draft: PlanDraft) => {
      const row = {
        kind: draft.kind,
        training_type_id: draft.kind === 'training' ? draft.trainingTypeId : null,
        template_id: draft.kind === 'training' ? draft.templateId : null,
        title: draft.title.trim() || null,
        note: draft.note.trim() || null,
        starts_on: draft.startsOn,
        start_time: draft.startTime || null,
        repeat_weekdays: draft.repeatWeekdays,
        repeat_until:
          draft.repeatWeekdays.length > 0 && draft.repeatUntil ? draft.repeatUntil : null,
      };
      const { error } = draft.id
        ? await supabase.from('plans').update(row).eq('id', draft.id)
        : await supabase.from('plans').insert(row);
      if (error) throw error;
    },
    onSettled: () => invalidate(queryClient, userId),
  });
}

/** Deletes a plan (all its dates). */
export function useDeletePlan() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (planId: string) => {
      const { error } = await supabase.from('plans').delete().eq('id', planId);
      if (error) throw error;
    },
    onSettled: () => invalidate(queryClient, userId),
  });
}

/** Cancels one date ("Ausfall") or takes the cancellation back. */
export function useSkipPlanDate() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (input: { planId: string; onDate: string; skip: boolean }) => {
      const { error } = input.skip
        ? await supabase.from('plan_skips').insert({ plan_id: input.planId, on_date: input.onDate })
        : await supabase
            .from('plan_skips')
            .delete()
            .eq('plan_id', input.planId)
            .eq('on_date', input.onDate);
      if (error) throw error;
    },
    onSettled: () => invalidate(queryClient, userId),
  });
}
