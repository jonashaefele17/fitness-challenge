import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUserId } from '@/features/auth';
import { supabase } from '@/shared/lib/supabase';
import { addDays, dayKey } from '../calendar';
import type { IcsEvent, IcsSeries } from '../ics';
import type { PlanChange, PlanDraft, PlanOccurrence } from '../types';
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
      // The generated types mark these columns as non-null; they can be null.
      return data.map((row) => ({
        planId: row.plan_id,
        userId: row.user_id,
        onDate: row.on_date,
        planDate: row.plan_date,
        startTime: (row.start_time as string | null) ? row.start_time.slice(0, 5) : null,
        kind: row.kind === 'event' ? 'event' : 'training',
        trainingType: (row.training_type_id as string | null)
          ? { id: row.training_type_id, name: row.type_name, icon: row.type_icon }
          : null,
        focus: (row.focus_id as string | null)
          ? { id: row.focus_id, name: row.focus_name, shortName: row.focus_short }
          : null,
        templateIds: row.template_ids,
        title: row.title,
        note: row.note,
        recurring: row.recurring,
        changed: row.changed,
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

/** A plan for editing, with its weekdays. */
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
          'id, kind, training_type_id, focus_id, template_ids, title, note, starts_on, start_time, repeat_weekdays, repeat_until, plan_days(weekday, focus_id, template_ids)',
        )
        .eq('id', planId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        kind: data.kind === 'event' ? 'event' : 'training',
        trainingTypeId: data.training_type_id,
        focusId: data.focus_id,
        templateIds: data.template_ids,
        title: data.title ?? '',
        note: data.note ?? '',
        startsOn: data.starts_on,
        startTime: data.start_time ? data.start_time.slice(0, 5) : '',
        repeatWeekdays: data.repeat_weekdays,
        repeatUntil: data.repeat_until ?? '',
        days: data.plan_days
          .map((day) => ({
            weekday: day.weekday,
            focusId: day.focus_id,
            templateIds: day.template_ids,
          }))
          .sort((a, b) => a.weekday - b.weekday),
      };
    },
  });
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>, userId: string) {
  return queryClient.invalidateQueries({ queryKey: planKeys.all(userId) });
}

/** Creates or updates a plan (a series as a whole, with its weekdays). */
export function useSavePlan() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (draft: PlanDraft) => {
      const training = draft.kind === 'training';
      const series = draft.repeatWeekdays.length > 0;
      const row = {
        kind: draft.kind,
        training_type_id: training ? draft.trainingTypeId : null,
        focus_id: training ? draft.focusId : null,
        template_ids: training ? draft.templateIds : [],
        title: draft.title.trim() || null,
        note: draft.note.trim() || null,
        starts_on: draft.startsOn,
        start_time: draft.startTime || null,
        repeat_weekdays: draft.repeatWeekdays,
        repeat_until: series && draft.repeatUntil ? draft.repeatUntil : null,
      };
      let planId = draft.id;
      if (planId) {
        const { error } = await supabase.from('plans').update(row).eq('id', planId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('plans').insert(row).select('id').single();
        if (error) throw error;
        planId = data.id;
      }
      // Weekdays: replaced as a whole (only those of the series that differ).
      const { error: removeError } = await supabase
        .from('plan_days')
        .delete()
        .eq('plan_id', planId);
      if (removeError) throw removeError;
      const days =
        training && series
          ? draft.days.filter((day) => draft.repeatWeekdays.includes(day.weekday))
          : [];
      if (days.length > 0) {
        const { error: dayError } = await supabase.from('plan_days').insert(
          days.map((day) => ({
            plan_id: planId,
            weekday: day.weekday,
            focus_id: day.focusId,
            template_ids: day.templateIds,
          })),
        );
        if (dayError) throw dayError;
      }
      return planId;
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
    mutationFn: async (input: { planId: string; planDate: string; skip: boolean }) => {
      const { error } = input.skip
        ? await supabase
            .from('plan_skips')
            .insert({ plan_id: input.planId, on_date: input.planDate })
        : await supabase
            .from('plan_skips')
            .delete()
            .eq('plan_id', input.planId)
            .eq('on_date', input.planDate);
      if (error) throw error;
    },
    onSettled: () => invalidate(queryClient, userId),
  });
}

/** "Nur diesen Termin ändern": set (or with `reset`, remove) the change of one date. */
export function useChangePlanDate() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async ({ change, reset }: { change: PlanChange; reset?: boolean }) => {
      if (reset) {
        const { error } = await supabase
          .from('plan_changes')
          .delete()
          .eq('plan_id', change.planId)
          .eq('on_date', change.planDate);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from('plan_changes').upsert({
        plan_id: change.planId,
        on_date: change.planDate,
        moved_to: change.onDate !== change.planDate ? change.onDate : null,
        start_time: change.startTime || null,
        clear_time: change.startTime === '',
        focus_id: change.focusId,
        template_ids: change.templateIds,
      });
      if (error) throw error;
    },
    onSettled: () => invalidate(queryClient, userId),
  });
}

/** The next date of a plan from today on (or its last one), e.g. to open from a link. */
export function useNextPlanDate(planId: string | null) {
  const userId = useUserId();
  return useQuery({
    queryKey: [...planKeys.all(userId), 'next', planId],
    enabled: planId !== null,
    queryFn: async (): Promise<PlanOccurrence | null> => {
      if (!planId) return null;
      const { data: plan, error } = await supabase
        .from('plans')
        .select('user_id')
        .eq('id', planId)
        .maybeSingle();
      if (error) throw error;
      if (!plan) return null;
      const today = new Date();
      const options = planOccurrencesOptions(
        userId,
        { from: addDays(today, -60), to: addDays(today, 180) },
        plan.user_id,
      );
      const dates = (await options.queryFn()).filter((o) => o.planId === planId);
      const todayKey = dayKey(today);
      return dates.find((o) => o.onDate >= todayKey) ?? dates.at(-1) ?? null;
    },
  });
}

/**
 * Everything a calendar file of a whole series needs: the series (weekdays, end), its
 * cancelled and changed dates (left out), and the changed dates on their own.
 */
export function useLoadPlanSeries() {
  const userId = useUserId();
  return useMutation({
    mutationFn: async (plan: PlanOccurrence): Promise<(IcsEvent | IcsSeries)[]> => {
      const { data, error } = await supabase
        .from('plans')
        .select(
          'starts_on, start_time, repeat_weekdays, repeat_until, note, training_focuses(name), plan_days(weekday)',
        )
        .eq('id', plan.planId)
        .single();
      if (error) throw error;
      const from = new Date(`${data.starts_on}T12:00:00`);
      // Open-ended: a year ahead is enough to find the changed dates.
      const to = data.repeat_until
        ? new Date(`${data.repeat_until}T12:00:00`)
        : addDays(new Date(), 365);
      const dates = await planOccurrencesOptions(userId, { from, to }, plan.userId).queryFn();
      const own = dates.filter((d) => d.planId === plan.planId);
      const changed = own.filter((d) => d.changed && d.status !== 'cancelled');
      const title =
        plan.kind === 'event' ? (plan.title ?? 'Event') : (plan.trainingType?.name ?? 'Training');
      // One focus for the whole series only when the weekdays do not differ.
      const focus = data.plan_days.length === 0 ? data.training_focuses?.name : null;
      const time = data.start_time ? data.start_time.slice(0, 5) : null;
      return [
        {
          uid: `${plan.planId}@fitness-challenge`,
          summary: [title, focus].filter(Boolean).join(' · '),
          description: data.note,
          date: data.starts_on,
          time,
          weekdays: data.repeat_weekdays,
          until: data.repeat_until,
          exceptDates: own
            .filter((d) => d.status === 'cancelled' || d.changed)
            .map((d) => d.planDate),
        },
        ...changed.map((d) => ({
          uid: `${plan.planId}-${d.planDate}@fitness-challenge`,
          summary: [title, d.focus?.name].filter(Boolean).join(' · '),
          description: d.note,
          date: d.onDate,
          time: d.startTime,
        })),
      ];
    },
  });
}
