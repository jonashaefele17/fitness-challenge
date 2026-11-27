import type {
  CreateGoalInput,
  Goal,
  GoalMetric,
  GoalReference,
  GoalUnit,
  UpdateGoalInput,
} from './types';

export const noReference: GoalReference = {
  exerciseId: null,
  deviceId: null,
  habitId: null,
  measurementKind: null,
};

/**
 * The same checks as the database (private.check_goal_values), as a German message for the
 * editor; null when fine.
 *   levels: start and target needed and different; a minimum from the start (inclusive)
 *   towards the target (exclusive) · rates: target > 0, 0 ≤ minimum < target; a habit quota
 *   at most 100 %, trainings at most 7 a week (days count)
 */
export function validateGoalValues(
  metric: Pick<GoalMetric, 'key' | 'kind'>,
  values: { startValue: number | null; minValue: number | null; targetValue: number | null },
): string | null {
  const { startValue: start, minValue: min, targetValue: target } = values;
  if (target === null) return 'Bitte gib einen Zielwert ein.';
  if (metric.kind === 'level') {
    if (start === null) return 'Bitte gib einen Startwert ein.';
    if (target === start) return 'Ziel und Startwert sind gleich.';
    if (min !== null) {
      const dir = Math.sign(target - start);
      if ((min - start) * dir < 0 || (target - min) * dir <= 0) {
        return 'Das Mindestziel liegt zwischen Startwert und Ziel.';
      }
    }
    return null;
  }
  if (target <= 0) return 'Das Ziel muss größer als 0 sein.';
  if (min !== null && (min < 0 || min >= target)) {
    return 'Das Mindestziel muss kleiner als das Ziel sein.';
  }
  if (metric.key === 'habit_rate' && target > 100) return 'Höchstens 100 %.';
  if (metric.key === 'trainings_per_week' && target > 7) {
    return 'Höchstens 7 – es zählt ein Training pro Tag.';
  }
  return null;
}

/** The end must lie after the start (days as "2026-12-01"). */
export function validatePeriod(startsOn: string, endsOn: string): string | null {
  return endsOn > startsOn ? null : 'Das Ende muss nach dem Start liegen.';
}

/** Lower is better (weight 85 → 80): the target lies below the start. */
export function lowerIsBetter(goal: Pick<Goal, 'startValue' | 'targetValue'>): boolean {
  return (
    goal.startValue !== null && goal.targetValue !== null && goal.targetValue < goal.startValue
  );
}

/**
 * The straight line from start (first day) to target (last day) for a chart; null for rates
 * or when the values are hidden from me.
 */
export function targetLine(
  goal: Pick<Goal, 'metricKind' | 'startsOn' | 'endsOn' | 'startValue' | 'targetValue'>,
): [{ onDate: string; value: number }, { onDate: string; value: number }] | null {
  if (goal.metricKind !== 'level' || goal.startValue === null || goal.targetValue === null) {
    return null;
  }
  return [
    { onDate: goal.startsOn, value: goal.startValue },
    { onDate: goal.endsOn, value: goal.targetValue },
  ];
}

/** What the cache shows for a new goal until the database has computed it. */
export function draftGoal(
  input: CreateGoalInput,
  context: {
    metric: GoalMetric;
    /** The metric's unit, or the chosen reference option's. */
    unit: GoalUnit;
    referenceLabel: string | null;
    referenceDetail: string | null;
    userId: string;
    today: string;
  },
): Goal {
  const { metric, today } = context;
  return {
    id: input.id,
    userId: context.userId,
    metric: input.metric,
    metricLabel: metric.label,
    metricKind: metric.kind,
    unit: context.unit,
    reference: { ...input.reference },
    referenceLabel: context.referenceLabel,
    referenceDetail: context.referenceDetail,
    reps: input.reps,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    visibility: input.visibility,
    archivedAt: null,
    createdAt: new Date().toISOString(),
    valuesHidden: false,
    evaluatedOn: today < input.endsOn ? today : input.endsOn,
    phase: today < input.startsOn ? 'upcoming' : today > input.endsOn ? 'ended' : 'running',
    startValue: input.startValue,
    minValue: input.minValue,
    targetValue: input.targetValue,
    currentValue: null,
    currentOn: null,
    expectedValue: null,
    progressPct: null,
    status: null,
    onTrack: null,
    counted: null,
    minMet: null,
    targetMet: null,
    countUnit: null,
    thisWeek: null,
    bestSet: null,
  };
}

/** A goal with an update applied (until the database has recomputed it). */
export function applyGoalUpdate(goal: Goal, input: UpdateGoalInput): Goal {
  return {
    ...goal,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    startValue: input.startValue,
    minValue: input.minValue,
    targetValue: input.targetValue,
    visibility: input.visibility,
  };
}

/**
 * What "Rückgängig" after an update sends: the goal as it was (as cached before the update),
 * from the same day on. Saving min and target as they were removes the new version again.
 */
export function undoGoalUpdate(
  previous: Goal,
  input: UpdateGoalInput,
  today: string,
): UpdateGoalInput {
  return {
    goalId: previous.id,
    startsOn: previous.startsOn,
    endsOn: previous.endsOn,
    startValue: previous.startValue,
    minValue: previous.minValue,
    targetValue: previous.targetValue ?? input.targetValue,
    visibility: previous.visibility,
    validFrom: input.validFrom ?? today,
  };
}
