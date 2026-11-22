import {
  queryOptions,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useUserId } from '@/features/auth';
import { supabase } from '@/shared/lib/supabase';
import type { Json } from '@/shared/types/database';
import { timeZone, todayKey } from '../dates';
import type {
  Habit,
  HabitCondition,
  HabitDay,
  HabitDefinition,
  HabitOption,
  HabitPause,
  HabitReminders,
  HabitStats,
  HabitSummary,
  HabitTemplate,
  HabitValue,
  HabitWeek,
  ShareLevel,
} from '../types';

export const habitKeys = {
  all: (userId: string) => ['habits', userId] as const,
  templates: () => ['habit-templates'] as const,
  list: (userId: string) => [...habitKeys.all(userId), 'list'] as const,
  days: (userId: string, from: string, to: string) =>
    [...habitKeys.all(userId), 'days', from, to] as const,
  weeks: (userId: string, from: string, to: string) =>
    [...habitKeys.all(userId), 'weeks', from, to] as const,
  pauses: (userId: string) => [...habitKeys.all(userId), 'pauses'] as const,
};

interface DefinitionRow {
  name: string;
  input_type: string;
  unit: string | null;
  rule: Json;
  frequency: string;
  weekdays: number[];
  times_per_week: number | null;
  time_of_day: string;
  options: Json;
  source: string;
}

function toDefinition(row: DefinitionRow): HabitDefinition {
  return {
    name: row.name,
    inputType: row.input_type as HabitDefinition['inputType'],
    unit: row.unit,
    rule: row.rule as unknown as HabitCondition[],
    frequency: row.frequency as HabitDefinition['frequency'],
    weekdays: row.weekdays,
    timesPerWeek: row.times_per_week,
    timeOfDay: row.time_of_day === 'morning' ? 'morning' : 'evening',
    options: row.options as unknown as HabitOption[],
    source: row.source as HabitDefinition['source'],
  };
}

/** The definition fields as save_habit takes them. */
function toDef(definition: Partial<HabitDefinition>): Json {
  const def: Record<string, unknown> = {};
  if (definition.name !== undefined) def.name = definition.name;
  if (definition.inputType !== undefined) def.input_type = definition.inputType;
  if (definition.unit !== undefined) def.unit = definition.unit ?? '';
  if (definition.rule !== undefined) def.rule = definition.rule;
  if (definition.frequency !== undefined) def.frequency = definition.frequency;
  if (definition.weekdays !== undefined) def.weekdays = definition.weekdays;
  if (definition.timesPerWeek !== undefined) def.times_per_week = definition.timesPerWeek;
  if (definition.timeOfDay !== undefined) def.time_of_day = definition.timeOfDay;
  if (definition.options !== undefined) def.options = definition.options;
  if (definition.source !== undefined) def.source = definition.source;
  return def as Json;
}

/** The library: templates to start from. */
export function useHabitTemplates() {
  return useQuery({
    queryKey: habitKeys.templates(),
    staleTime: 60 * 60_000,
    queryFn: async (): Promise<HabitTemplate[]> => {
      const { data, error } = await supabase.from('habit_templates').select('*').order('sort');
      if (error) throw error;
      return data.map((row) => ({
        id: row.id,
        key: row.key,
        description: row.description,
        ...toDefinition(row),
      }));
    },
  });
}

/** My habits (active and archived) with the definition valid today. */
/** A person's habits (mine: all; others: what they share), with today's definition. */
async function fetchHabits(person: string): Promise<Habit[]> {
  const { data, error } = await supabase
    .from('habits')
    .select(
      'id, user_id, template_id, source_habit_id, sort, archived_at, share_level, habit_versions(*)',
    )
    .eq('user_id', person)
    .order('sort');
  if (error) throw error;
  const today = todayKey();
  return data.flatMap((row) => {
    const versions = [...row.habit_versions].sort((a, b) =>
      a.valid_from.localeCompare(b.valid_from),
    );
    const current = [...versions].reverse().find((v) => v.valid_from <= today) ?? versions[0];
    if (!current || !versions[0]) return [];
    return [
      {
        id: row.id,
        templateId: row.template_id,
        archived: row.archived_at !== null,
        shareLevel: row.share_level as Habit['shareLevel'],
        userId: row.user_id,
        sourceHabitId: row.source_habit_id,
        current: toDefinition(current),
        since: versions[0].valid_from,
      },
    ];
  });
}

export function useMyHabits(personId?: string) {
  const userId = useUserId();
  const person = personId ?? userId;
  return useQuery({
    queryKey: [...habitKeys.list(userId), person],
    queryFn: () => fetchHabits(person),
  });
}

/** The habits of several people at once (the group's comparison). */
export function useHabitsOfPeople(personIds: string[]) {
  const userId = useUserId();
  const results = useQueries({
    queries: personIds.map((person) => ({
      queryKey: [...habitKeys.list(userId), person],
      queryFn: () => fetchHabits(person),
    })),
  });
  return personIds.map((person, index) => ({
    personId: person,
    habits: results[index]?.data ?? [],
  }));
}

/**
 * The catalog beyond the standard templates: habits group mates share that they made
 * themselves (not taken from a template or someone else). Each follows its owner's habit.
 */
export function useGroupCatalog() {
  const userId = useUserId();
  return useQuery({
    queryKey: [...habitKeys.all(userId), 'catalog'],
    queryFn: async (): Promise<(Habit & { ownerName: string })[]> => {
      const { data, error } = await supabase
        .from('habits')
        .select('user_id')
        .neq('user_id', userId)
        .neq('share_level', 'private')
        .is('template_id', null)
        .is('source_habit_id', null)
        .is('archived_at', null);
      if (error) throw error;
      const owners = [...new Set(data.map((row) => row.user_id))];
      if (owners.length === 0) return [];
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', owners);
      if (profileError) throw profileError;
      const habits = (await Promise.all(owners.map(fetchHabits))).flat();
      return habits
        .filter((h) => !h.archived && h.templateId === null && h.sourceHabitId === null)
        .map((h) => ({
          ...h,
          ownerName: profiles.find((p) => p.id === h.userId)?.display_name ?? '',
        }));
    },
  });
}

/** Take over a group mate's habit as an own one (own goals). */
export function useAdoptHabit() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (input: {
      sourceId: string;
      validFrom: string;
      definition: Partial<HabitDefinition>;
      shareLevel: ShareLevel;
    }) => {
      const { data, error } = await supabase.rpc('adopt_habit', {
        p_source_id: input.sourceId,
        p_valid_from: input.validFrom,
        p_def: toDef(input.definition),
      });
      if (error) throw error;
      const { error: shareError } = await supabase
        .from('habits')
        .update({ share_level: input.shareLevel })
        .eq('id', data);
      if (shareError) throw shareError;
      return data;
    },
    onSettled: refresh,
  });
}

/** Super admin: a habit from the group becomes a standard template (values stay). */
export function usePromoteHabit() {
  const queryClient = useQueryClient();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (habitId: string) => {
      const { error } = await supabase.rpc('promote_habit_to_template', { p_habit_id: habitId });
      if (error) throw error;
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: habitKeys.templates() });
      await refresh();
    },
  });
}

/** How my habits stand per day in a range. */
/** Query options for useHabitDays (also for several people at once). */
export function habitDaysOptions(userId: string, from: string, to: string, person: string) {
  return queryOptions({
    queryKey: [...habitKeys.days(userId, from, to), person],
    queryFn: async (): Promise<HabitDay[]> => {
      const { data, error } = await supabase.rpc('habit_days', {
        p_user_id: person,
        p_from: from,
        p_to: to,
        p_today: todayKey(),
        p_time_zone: timeZone(),
      });
      if (error) throw error;
      return data.map((row) => ({
        habitId: row.habit_id,
        onDate: row.on_date,
        name: row.name,
        inputType: row.input_type as HabitDay['inputType'],
        frequency: row.frequency as HabitDay['frequency'],
        source: row.source as HabitDay['source'],
        timeOfDay: row.time_of_day === 'morning' ? 'morning' : 'evening',
        due: row.due,
        paused: row.paused,
        value: row.value as unknown as HabitValue | null,
        state: (row.state as HabitDay['state'] | null) ?? null,
      }));
    },
  });
}

export function useHabitDays(from: string, to: string, personId?: string) {
  const userId = useUserId();
  return useQuery(habitDaysOptions(userId, from, to, personId ?? userId));
}

/** Weekly habits per week (done days, target, state). */
/** Query options for useHabitWeeks (also for several people at once). */
export function habitWeeksOptions(userId: string, from: string, to: string, person: string) {
  return queryOptions({
    queryKey: [...habitKeys.weeks(userId, from, to), person],
    queryFn: async (): Promise<HabitWeek[]> => {
      const { data, error } = await supabase.rpc('habit_weeks', {
        p_user_id: person,
        p_from: from,
        p_to: to,
        p_today: todayKey(),
        p_time_zone: timeZone(),
      });
      if (error) throw error;
      return data.map((row) => ({
        habitId: row.habit_id,
        weekStart: row.week_start,
        doneDays: row.done_days,
        target: row.target,
        state: row.state as HabitWeek['state'],
      }));
    },
  });
}

export function useHabitWeeks(from: string, to: string, personId?: string) {
  const userId = useUserId();
  return useQuery(habitWeeksOptions(userId, from, to, personId ?? userId));
}

function useRefresh() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return () => queryClient.invalidateQueries({ queryKey: habitKeys.all(userId) });
}

/** Create a habit (from a template or own), or change one from a day on. */
export function useSaveHabit() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (input: {
      habitId: string | null;
      templateId: string | null;
      validFrom: string;
      definition: Partial<HabitDefinition>;
      /** Who sees it (not versioned: it holds for the whole habit). */
      shareLevel?: ShareLevel;
    }) => {
      const { data, error } = await supabase.rpc('save_habit', {
        // null: a new habit (the generated types do not know it may be null)
        p_habit_id: input.habitId as string,
        p_template_id: input.templateId as string,
        p_valid_from: input.validFrom,
        p_def: toDef(input.definition),
      });
      if (error) throw error;
      if (input.shareLevel) {
        const { error: shareError } = await supabase
          .from('habits')
          .update({ share_level: input.shareLevel })
          .eq('id', data);
        if (shareError) throw shareError;
      }
      return data;
    },
    onSettled: refresh,
  });
}

export function useArchiveHabit() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (input: { habitId: string; archive: boolean }) => {
      const { error } = await supabase.rpc('archive_habit', {
        p_habit_id: input.habitId,
        p_archive: input.archive,
      });
      if (error) throw error;
    },
    onSettled: refresh,
  });
}

/** An entry for a day; shows at once, saved in the background. */
export function useSetHabitEntry() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (input: { habitId: string; onDate: string; value: HabitValue | null }) => {
      const { error } = await supabase.rpc('set_habit_entry', {
        p_habit_id: input.habitId,
        p_on_date: input.onDate,
        // null removes the entry
        p_value: input.value as Json,
      });
      if (error) throw error;
    },
    onMutate: async (input) => {
      const prefix = [...habitKeys.all(userId), 'days'];
      await queryClient.cancelQueries({ queryKey: prefix });
      queryClient.setQueriesData<HabitDay[]>({ queryKey: prefix }, (days) =>
        days?.map((day) =>
          day.habitId === input.habitId && day.onDate === input.onDate
            ? { ...day, value: input.value }
            : day,
        ),
      );
    },
    onSettled: refresh,
  });
}

export function usePauses() {
  const userId = useUserId();
  return useQuery({
    queryKey: habitKeys.pauses(userId),
    queryFn: async (): Promise<HabitPause[]> => {
      const { data, error } = await supabase
        .from('habit_pauses')
        .select('id, from_date, to_date, note')
        .eq('user_id', userId)
        .order('from_date', { ascending: false });
      if (error) throw error;
      return data.map((row) => ({
        id: row.id,
        fromDate: row.from_date,
        toDate: row.to_date,
        note: row.note,
      }));
    },
  });
}

export function useAddPause() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (input: { fromDate: string; toDate: string; note: string }) => {
      const { error } = await supabase.from('habit_pauses').insert({
        from_date: input.fromDate,
        to_date: input.toDate,
        note: input.note.trim() || null,
      });
      if (error) throw error;
    },
    onSettled: refresh,
  });
}

export function useRemovePause() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (pauseId: string) => {
      const { error } = await supabase.from('habit_pauses').delete().eq('id', pauseId);
      if (error) throw error;
    },
    onSettled: refresh,
  });
}

/** This week's weekly habits (e.g. Sport 2/4), for a glance on Heute. */
export function useThisWeek() {
  const today = todayKey();
  const habits = (useMyHabits().data ?? []).filter((h) => !h.archived);
  const weeks = useHabitWeeks(today, today).data ?? [];
  return weeks.flatMap((week) => {
    const habit = habits.find((h) => h.id === week.habitId);
    return habit
      ? [
          {
            name: habit.current.name,
            doneDays: week.doneDays,
            target: week.target,
            state: week.state,
          },
        ]
      : [];
  });
}

/** Quota and streaks per habit; the quota for the given range. */
export function useHabitStats(from: string, to: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: [...habitKeys.all(userId), 'stats', from, to],
    queryFn: async (): Promise<HabitStats[]> => {
      const { data, error } = await supabase.rpc('habit_stats', {
        p_user_id: userId,
        p_from: from,
        p_to: to,
        p_today: todayKey(),
        p_time_zone: timeZone(),
      });
      if (error) throw error;
      return data.map((row) => ({
        habitId: row.habit_id,
        unit: row.unit === 'weeks' ? 'weeks' : 'days',
        counted: row.counted,
        met: row.met,
        quota: (row.quota as number | null) ?? null,
        currentStreak: row.current_streak,
        bestStreak: row.best_streak,
      }));
    },
  });
}

/** The figures of each habit in a range, in plain words (see habit_summary). */
/** Query options for useHabitSummary (also for several people at once). */
export function habitSummaryOptions(userId: string, from: string, to: string, person: string) {
  return queryOptions({
    queryKey: [...habitKeys.all(userId), 'summary', from, to, person],
    queryFn: async (): Promise<HabitSummary[]> => {
      const { data, error } = await supabase.rpc('habit_summary', {
        p_user_id: person,
        p_from: from,
        p_to: to,
        p_today: todayKey(),
        p_time_zone: timeZone(),
      });
      if (error) throw error;
      const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
      return data.map((row) => ({
        habitId: row.habit_id,
        counted: row.counted,
        met: row.met,
        quota: num(row.quota),
        previousQuota: num(row.previous_quota),
        avgValue: num(row.avg_value),
        bestValue: num(row.best_value),
        avgStart: num(row.avg_start),
        avgEnd: num(row.avg_end),
        avgDuration: num(row.avg_duration),
        choiceCounts: (row.choice_counts as Record<string, number> | null) ?? {},
        itemCounts: (row.item_counts as Record<string, number> | null) ?? {},
        completeDays: row.complete_days,
      }));
    },
  });
}

export function useHabitSummary(from: string, to: string, personId?: string) {
  const userId = useUserId();
  return useQuery(habitSummaryOptions(userId, from, to, personId ?? userId));
}

/** My check-in reminder times. */
export function useReminders() {
  const userId = useUserId();
  return useQuery({
    queryKey: [...habitKeys.all(userId), 'reminders'],
    queryFn: async (): Promise<HabitReminders> => {
      const { data, error } = await supabase
        .from('habit_reminders')
        .select('morning_at, evening_at')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return {
        morningAt: data?.morning_at ? data.morning_at.slice(0, 5) : null,
        eveningAt: data?.evening_at ? data.evening_at.slice(0, 5) : null,
      };
    },
  });
}

export function useSaveReminders() {
  const userId = useUserId();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (reminders: HabitReminders) => {
      const { error } = await supabase.from('habit_reminders').upsert({
        user_id: userId,
        morning_at: reminders.morningAt,
        evening_at: reminders.eveningAt,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSettled: refresh,
  });
}
