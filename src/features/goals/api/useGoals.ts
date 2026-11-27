import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { useUserId } from '@/features/auth';
import { supabase } from '@/shared/lib/supabase';
import type { Database } from '@/shared/types/database';
import { timeZone, todayKey } from '../dates';
import { applyGoalUpdate, draftGoal } from '../goal';
import type {
  CreateGoalInput,
  Goal,
  GoalBestSet,
  GoalHistoryPoint,
  GoalMetric,
  GoalMetricKind,
  GoalPhase,
  GoalPointState,
  GoalReferenceKind,
  GoalReferenceOption,
  GoalStartSuggestion,
  GoalStartSuggestionInput,
  GoalStatus,
  GoalUnit,
  GoalVisibility,
  UpdateGoalInput,
} from '../types';
import { goalKeys } from './keys';

type GoalRow = Database['public']['Functions']['goal_progress']['Returns'][number];

/** The generated types do not know that computed columns may be null. */
const num = (v: number | null | undefined) => v ?? null;
const str = (v: string | null | undefined) => v ?? null;

function bestSet(
  weightKg: number | null | undefined,
  reps: number | null | undefined,
  durationSeconds: number | null | undefined,
): GoalBestSet | null {
  const set = { weightKg: num(weightKg), reps: num(reps), durationSeconds: num(durationSeconds) };
  return set.weightKg === null && set.reps === null && set.durationSeconds === null ? null : set;
}

function toGoal(row: GoalRow): Goal {
  const weekTarget = num(row.week_target);
  return {
    id: row.id,
    userId: row.user_id,
    metric: row.metric,
    metricLabel: row.metric_label,
    metricKind: row.metric_kind as GoalMetricKind,
    unit: row.unit as GoalUnit,
    reference: {
      exerciseId: str(row.exercise_id),
      deviceId: str(row.device_id),
      habitId: str(row.habit_id),
      measurementKind: str(row.measurement_kind),
    },
    referenceLabel: str(row.reference_label),
    referenceDetail: str(row.reference_detail),
    reps: num(row.reps),
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    visibility: row.visibility as GoalVisibility,
    archivedAt: str(row.archived_at),
    createdAt: row.created_at,
    valuesHidden: row.values_hidden,
    evaluatedOn: row.evaluated_on,
    phase: row.phase as GoalPhase,
    startValue: num(row.start_value),
    minValue: num(row.min_value),
    targetValue: num(row.target_value),
    currentValue: num(row.current_value),
    currentOn: str(row.current_on),
    expectedValue: num(row.expected_value),
    progressPct: num(row.progress_pct),
    status: str(row.status) as GoalStatus | null,
    // null: nothing to judge yet (the generated types do not know)
    onTrack: row.on_track,
    counted: num(row.counted),
    minMet: num(row.min_met),
    targetMet: num(row.target_met),
    countUnit: str(row.count_unit) as 'weeks' | 'days' | null,
    thisWeek:
      weekTarget === null
        ? null
        : { done: num(row.week_done) ?? 0, min: num(row.week_min), target: weekTarget },
    bestSet: bestSet(row.best_weight_kg, row.best_reps, row.best_duration_seconds),
  };
}

async function fetchGoals(
  personId: string | null,
  today: string,
  includeArchived: boolean,
): Promise<Goal[]> {
  const { data, error } = await supabase.rpc('goal_progress', {
    // null: mine (the generated types do not know it may be null)
    p_user_id: personId as string,
    p_today: today,
    p_time_zone: timeZone(),
    p_include_archived: includeArchived,
  });
  if (error) throw error;
  return data.map(toGoal);
}

// ---------------------------------------------------------------------------
// Catalogue and editor helpers
// ---------------------------------------------------------------------------

/** The metrics (global, in their order). Rarely changes: cached for a day. */
export function useGoalMetrics() {
  const userId = useUserId();
  return useQuery({
    queryKey: goalKeys.metrics(userId),
    staleTime: 24 * 60 * 60_000,
    queryFn: async (): Promise<GoalMetric[]> => {
      const { data, error } = await supabase
        .from('goal_metrics')
        .select('key, label, description, kind, reference, unit, sort')
        .order('sort');
      if (error) throw error;
      return data.map((row) => ({
        key: row.key,
        label: row.label,
        description: row.description,
        kind: row.kind as GoalMetricKind,
        reference: row.reference as GoalReferenceKind | null,
        unit: row.unit as GoalUnit | null,
        sort: row.sort,
      }));
    },
  });
}

/**
 * What a goal of a metric can point at (exercises I have done, my habits, the measurement
 * kinds), newest used first. null metric or a metric without references: disabled / empty.
 */
export function useGoalReferenceOptions(metric: string | null) {
  const userId = useUserId();
  return useQuery({
    queryKey: goalKeys.referenceOptions(userId, metric ?? ''),
    enabled: metric !== null,
    queryFn: async (): Promise<GoalReferenceOption[]> => {
      const { data, error } = await supabase.rpc('goal_reference_options', {
        p_metric: metric ?? '',
      });
      if (error) throw error;
      return data.map((row) => ({
        reference: {
          exerciseId: str(row.exercise_id),
          deviceId: str(row.device_id),
          habitId: str(row.habit_id),
          measurementKind: str(row.measurement_kind),
        },
        label: row.label,
        detail: str(row.detail),
        unit: row.unit as GoalUnit,
        needsReps: row.needs_reps,
        lastUsedOn: str(row.last_used_on),
      }));
    },
  });
}

/**
 * The suggested start value for a new goal (weight: the current 7-day trend; exercise: the
 * best set of the last 4 weeks; measurement: the latest check-in; trainings and habit: the
 * last 4 weeks). null input: disabled.
 */
export function useGoalStartSuggestion(input: GoalStartSuggestionInput | null) {
  const userId = useUserId();
  const today = todayKey();
  const ref = input?.reference ?? {};
  const reference = [
    ref.exerciseId ?? null,
    ref.deviceId ?? null,
    ref.habitId ?? null,
    ref.measurementKind ?? null,
  ];
  return useQuery({
    queryKey: goalKeys.suggestion(
      userId,
      input?.metric ?? '',
      today,
      reference,
      input?.reps ?? null,
    ),
    enabled: input !== null,
    queryFn: async (): Promise<GoalStartSuggestion> => {
      // Optional arguments left out are null in the database.
      const { data, error } = await supabase.rpc('goal_start_suggestion', {
        p_metric: input?.metric ?? '',
        p_today: today,
        p_time_zone: timeZone(),
        ...(ref.exerciseId ? { p_exercise_id: ref.exerciseId } : {}),
        ...(ref.deviceId ? { p_device_id: ref.deviceId } : {}),
        ...(ref.habitId ? { p_habit_id: ref.habitId } : {}),
        ...(ref.measurementKind ? { p_measurement_kind: ref.measurementKind } : {}),
        ...(input?.reps ? { p_reps: input.reps } : {}),
      });
      if (error) throw error;
      const row = data[0];
      return {
        value: num(row?.value),
        onDate: str(row?.on_date),
        reps: num(row?.reps),
        bestSet: bestSet(row?.best_weight_kg, row?.best_reps, row?.best_duration_seconds),
      };
    },
  });
}

// ---------------------------------------------------------------------------
// Goals with their figures
// ---------------------------------------------------------------------------

/**
 * My goals with their figures as of today, in metric order (archived ones only with
 * includeArchived, after the others).
 */
export function useGoals(options: { includeArchived?: boolean } = {}) {
  const userId = useUserId();
  const today = todayKey();
  const includeArchived = options.includeArchived ?? false;
  return useQuery({
    queryKey: goalKeys.list(userId, userId, today, includeArchived),
    queryFn: () => fetchGoals(null, today, includeArchived),
  });
}

/**
 * Query options for a person's goals (not archived) as of a day – mine when personId is me
 * (the same cache as useGoals), someone else's shared ones otherwise (as useGoalsOfPerson).
 * For loading several people at once with useQueries.
 */
export function goalListOptions(userId: string, personId: string, today: string) {
  return queryOptions({
    queryKey: goalKeys.list(userId, personId, today, false),
    queryFn: () => fetchGoals(personId === userId ? null : personId, today, false),
  });
}

/**
 * Someone else's shared goals (for comparison): only when we share a group; kg / cm masked
 * as their sharing says (Goal.valuesHidden). null: disabled.
 */
export function useGoalsOfPerson(personId: string | null) {
  const userId = useUserId();
  const today = todayKey();
  return useQuery({
    ...goalListOptions(userId, personId ?? '', today),
    enabled: personId !== null,
  });
}

/** A goal's course for the chart against the target line (null goalId: disabled). */
export function useGoalHistory(goalId: string | null) {
  const userId = useUserId();
  const today = todayKey();
  return useQuery({
    queryKey: goalKeys.history(userId, goalId ?? '', today),
    enabled: goalId !== null,
    queryFn: async (): Promise<GoalHistoryPoint[]> => {
      const { data, error } = await supabase.rpc('goal_history', {
        p_goal_id: goalId ?? '',
        p_today: today,
        p_time_zone: timeZone(),
      });
      if (error) throw error;
      return data.map((row) => ({
        onDate: row.on_date,
        value: num(row.value),
        minValue: num(row.min_value),
        targetValue: num(row.target_value),
        expectedValue: num(row.expected_value),
        progressPct: num(row.progress_pct),
        state: str(row.state) as GoalPointState | null,
      }));
    },
  });
}

// ---------------------------------------------------------------------------
// Changes (optimistic, with rollback)
// ---------------------------------------------------------------------------

/** Optimistic changes to all cached lists of my goals; returns the snapshots to roll back to. */
function useGoalCache() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  const lists = goalKeys.lists(userId);
  return {
    async change(change: (list: Goal[], includeArchived: boolean) => Goal[]) {
      await queryClient.cancelQueries({ queryKey: lists });
      const snapshots = queryClient.getQueriesData<Goal[]>({ queryKey: lists });
      for (const [key, list] of snapshots) {
        if (list) queryClient.setQueryData<Goal[]>(key, change(list, key[5] === true));
      }
      return snapshots;
    },
    rollback(snapshots: [QueryKey, Goal[] | undefined][] | undefined) {
      for (const [key, list] of snapshots ?? []) queryClient.setQueryData(key, list);
    },
    /** Figures, history and suggestions are computed: refetch everything of the module. */
    refresh: () => queryClient.invalidateQueries({ queryKey: goalKeys.all(userId) }),
  };
}

/** How the new goal shows until the database has computed it (optional). */
export interface GoalDraftDisplay {
  metric: GoalMetric;
  /** The metric's unit, or the chosen reference option's. */
  unit: GoalUnit;
  referenceLabel: string | null;
  referenceDetail: string | null;
}

/**
 * Create a goal (shows at once when `display` is given). Undo: useDiscardGoal. Resolves to
 * the id.
 */
export function useCreateGoal() {
  const cache = useGoalCache();
  const userId = useUserId();
  return useMutation({
    mutationFn: async ({ input }: { input: CreateGoalInput; display?: GoalDraftDisplay }) => {
      const ref = input.reference;
      const { data, error } = await supabase.rpc('create_goal', {
        p_id: input.id,
        p_metric: input.metric,
        p_starts_on: input.startsOn,
        p_ends_on: input.endsOn,
        // null allowed (the generated types do not know)
        p_start_value: input.startValue as number,
        p_min_value: input.minValue as number,
        p_target_value: input.targetValue,
        p_visibility: input.visibility,
        ...(ref.exerciseId ? { p_exercise_id: ref.exerciseId } : {}),
        ...(ref.deviceId ? { p_device_id: ref.deviceId } : {}),
        ...(ref.habitId ? { p_habit_id: ref.habitId } : {}),
        ...(ref.measurementKind ? { p_measurement_kind: ref.measurementKind } : {}),
        ...(input.reps !== null ? { p_reps: input.reps } : {}),
      });
      if (error) throw error;
      return data;
    },
    onMutate: ({ input, display }) =>
      cache.change((list) =>
        display
          ? [
              ...list.filter((g) => g.id !== input.id),
              draftGoal(input, { ...display, userId, today: todayKey() }),
            ]
          : list,
      ),
    onError: (_error, _input, snapshots) => {
      cache.rollback(snapshots);
    },
    onSettled: cache.refresh,
  });
}

/**
 * Change a goal (full new state, see UpdateGoalInput): min and target from validFrom (default
 * today) as a new version. Undo: useUpdateGoal again with undoGoalUpdate(previous, input,
 * today).
 */
export function useUpdateGoal() {
  const cache = useGoalCache();
  return useMutation({
    mutationFn: async (input: UpdateGoalInput) => {
      const { error } = await supabase.rpc('update_goal', {
        p_goal_id: input.goalId,
        p_starts_on: input.startsOn,
        p_ends_on: input.endsOn,
        p_start_value: input.startValue as number,
        p_min_value: input.minValue as number,
        p_target_value: input.targetValue,
        p_visibility: input.visibility,
        p_valid_from: input.validFrom ?? todayKey(),
      });
      if (error) throw error;
    },
    onMutate: (input) =>
      cache.change((list) =>
        list.map((g) => (g.id === input.goalId ? applyGoalUpdate(g, input) : g)),
      ),
    onError: (_error, _input, snapshots) => {
      cache.rollback(snapshots);
    },
    onSettled: cache.refresh,
  });
}

/**
 * Take back a goal that was just created ("Rückgängig"): it is removed without a trace.
 * Only shortly after creating; later goals are archived (useArchiveGoal).
 */
export function useDiscardGoal() {
  const cache = useGoalCache();
  return useMutation({
    mutationFn: async (goalId: string) => {
      const { error } = await supabase.rpc('discard_goal', { p_goal_id: goalId });
      if (error) throw error;
    },
    onMutate: (goalId) => cache.change((list) => list.filter((g) => g.id !== goalId)),
    onError: (_error, _input, snapshots) => {
      cache.rollback(snapshots);
    },
    onSettled: cache.refresh,
  });
}

/** Archive a goal (gone from the list, kept; others no longer see it). Undo: useRestoreGoal. */
export function useArchiveGoal() {
  const cache = useGoalCache();
  return useMutation({
    mutationFn: async (goalId: string) => {
      const { error } = await supabase.rpc('archive_goal', {
        p_goal_id: goalId,
        p_archive: true,
      });
      if (error) throw error;
    },
    onMutate: (goalId) => {
      const now = new Date().toISOString();
      return cache.change((list, includeArchived) =>
        includeArchived
          ? list.map((g) => (g.id === goalId ? { ...g, archivedAt: now } : g))
          : list.filter((g) => g.id !== goalId),
      );
    },
    onError: (_error, _input, snapshots) => {
      cache.rollback(snapshots);
    },
    onSettled: cache.refresh,
  });
}

/** Bring an archived goal back (also "Rückgängig" after archiving). Takes the goal as cached. */
export function useRestoreGoal() {
  const cache = useGoalCache();
  return useMutation({
    mutationFn: async (goal: Goal) => {
      const { error } = await supabase.rpc('archive_goal', {
        p_goal_id: goal.id,
        p_archive: false,
      });
      if (error) throw error;
    },
    onMutate: (goal) =>
      cache.change((list) => [
        ...list.filter((g) => g.id !== goal.id),
        { ...goal, archivedAt: null },
      ]),
    onError: (_error, _input, snapshots) => {
      cache.rollback(snapshots);
    },
    onSettled: cache.refresh,
  });
}
