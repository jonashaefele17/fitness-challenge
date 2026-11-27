import type { Goal, GoalMetric, GoalReferenceOption, GoalUnit } from './types';

/**
 * Presentation helpers for the goal screens (overview, create flow, detail): pure, so they
 * can be tested without rendering.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const utc = (day: string) => Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10));
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** A day plus n days ("2026-12-01" + 6 → "2026-12-07"). */
export function addDays(day: string, n: number): string {
  return fromUtc(utc(day) + n * DAY_MS);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((utc(to) - utc(from)) / DAY_MS);
}

/** Quick choices for a goal's length in the editor. */
export type PeriodChoice = '4w' | '8w' | '12w' | '6m';

export const PERIOD_CHOICES: { value: PeriodChoice; label: string }[] = [
  { value: '4w', label: '4 Wochen' },
  { value: '8w', label: '8 Wochen' },
  { value: '12w', label: '12 Wochen' },
  { value: '6m', label: '6 Monate' },
];

/**
 * The last day of a period of that length starting on `start` (both days count): 4 weeks
 * from a Monday end on the Sunday four weeks later; 6 months from 1 Dec end on 31 May.
 */
export function periodEnd(start: string, choice: PeriodChoice): string {
  if (choice === '6m') {
    const year = +start.slice(0, 4);
    const month = +start.slice(5, 7) - 1 + 6;
    const day = +start.slice(8, 10);
    // Clamp to the month's last day (31 Aug + 6 months → 28/29 Feb, not 3 Mar).
    const lastOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return addDays(fromUtc(Date.UTC(year, month, Math.min(day, lastOfMonth))), -1);
  }
  const weeks = { '4w': 4, '8w': 8, '12w': 12 }[choice];
  return addDays(start, weeks * 7 - 1);
}

/** The quick choice a period matches, if any. */
export function matchingPeriodChoice(start: string, end: string): PeriodChoice | null {
  return PERIOD_CHOICES.find((c) => periodEnd(start, c.value) === end)?.value ?? null;
}

/**
 * Where the minimum sits on a progress bar (0 … 100), null without one: levels between
 * start (0) and target (100); rates as a share of the target.
 */
export function minMarkerPct(
  goal: Pick<Goal, 'metricKind' | 'startValue' | 'minValue' | 'targetValue'>,
): number | null {
  const { startValue: start, minValue: min, targetValue: target } = goal;
  if (min === null || target === null) return null;
  let pct: number;
  if (goal.metricKind === 'level') {
    if (start === null || target === start) return null;
    pct = ((min - start) / (target - start)) * 100;
  } else {
    if (target <= 0) return null;
    pct = (min / target) * 100;
  }
  return Math.min(100, Math.max(0, pct));
}

/** One step of the number wheel for a goal value. */
export function wheelStep(metric: string, unit: GoalUnit, field: 'start' | 'goal'): number {
  switch (unit) {
    case 'kg':
      // Body weight is read to 0.1 kg; targets in half kilos. Weights on a bar in 2.5 kg.
      if (metric === 'exercise_best') return 2.5;
      return field === 'start' ? 0.1 : 0.5;
    case 'cm':
      return 0.5;
    case 'seconds':
      return 5;
    case 'percent':
      return 5;
    case 'reps':
    case 'per_week':
      return 1;
  }
}

/** A value moved onto the wheel's grid (84,3 with steps of 0,5 → 84,5). */
export function snapToStep(value: number, step: number): number {
  return Math.round(Math.round(value / step) * step * 100) / 100;
}

/** "82,5" / "82.5" → 82.5; null when it is not a number ≥ 0. */
export function parseGoalNumber(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (normalized === '') return null;
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** What a value is measured in, for the wheel's caption: "in kg", "pro Woche", "in %". */
export function unitCaption(unit: GoalUnit): string {
  switch (unit) {
    case 'kg':
      return 'in kg';
    case 'cm':
      return 'in cm';
    case 'reps':
      return 'in Wiederholungen';
    case 'seconds':
      return 'in Sekunden';
    case 'percent':
      return 'in %';
    case 'per_week':
      return 'pro Woche';
  }
}

/** Screens of the create flow. */
export type CreateStep =
  | 'metric'
  | 'reference'
  | 'reps'
  | 'start'
  | 'target'
  | 'min'
  | 'period'
  | 'visibility'
  | 'summary';

/**
 * The screens for a metric (and the chosen reference): a reference only when the metric
 * points at something, reps for weight exercises, a start value for levels (rates take the
 * suggestion as their baseline and show it next to the target).
 */
export function createSteps(
  metric: Pick<GoalMetric, 'kind' | 'reference'> | null,
  option: Pick<GoalReferenceOption, 'needsReps'> | null,
): CreateStep[] {
  return [
    'metric',
    ...(metric?.reference ? (['reference'] as const) : []),
    ...(option?.needsReps ? (['reps'] as const) : []),
    ...(metric?.kind === 'level' ? (['start'] as const) : []),
    'target',
    'min',
    'period',
    'visibility',
    'summary',
  ];
}

/** Where the empty target wheel starts rolling from. */
export function targetWheelStart(
  metric: Pick<GoalMetric, 'key' | 'kind'>,
  unit: GoalUnit,
  start: number | null,
): number {
  if (metric.kind === 'level') {
    return start === null ? 0 : snapToStep(start, wheelStep(metric.key, unit, 'goal'));
  }
  if (metric.key === 'trainings_per_week') {
    return start === null ? 3 : Math.min(7, Math.max(1, Math.ceil(start)));
  }
  // Habit quota: a little above what was done so far.
  return start === null ? 80 : Math.min(100, snapToStep(start, 5) + 10);
}

/** What sharing shows the group, honestly per metric (masking rules of goal_progress). */
export function sharingNote(metric: string): string {
  switch (metric) {
    case 'body_weight':
      return 'Die anderen sehen immer Fortschritt in % und den Status. Kilos nur, wenn du dein Gewicht mit kg teilst (Körper → Sichtbarkeit).';
    case 'body_measurement':
      return 'Die anderen sehen Fortschritt in % und den Status, nie die Zentimeter.';
    case 'habit_rate':
      return 'Die anderen sehen den Namen des Habits und deine Quote – auch wenn das Habit selbst privat ist.';
    default:
      return 'Die anderen sehen das Ziel mit allen Werten.';
  }
}

/** The goals of the overview: running and upcoming ones; the rest is "Beendet". */
export function splitGoals(goals: Goal[]): { active: Goal[]; ended: Goal[] } {
  const active: Goal[] = [];
  const ended: Goal[] = [];
  for (const goal of goals) {
    if (goal.archivedAt === null && goal.phase !== 'ended') active.push(goal);
    else ended.push(goal);
  }
  return { active, ended };
}

/** "noch 12 Tage", "noch 1 Tag", "endet heute", "startet in 3 Tagen", "beendet". */
export function periodStateText(goal: Pick<Goal, 'phase' | 'startsOn' | 'endsOn'>, today: string) {
  if (goal.phase === 'ended') return 'beendet';
  if (goal.phase === 'upcoming') {
    const n = daysBetween(today, goal.startsOn);
    return n === 1 ? 'startet morgen' : `startet in ${String(n)} Tagen`;
  }
  const left = daysBetween(today, goal.endsOn);
  if (left <= 0) return 'endet heute';
  return left === 1 ? 'noch 1 Tag' : `noch ${String(left)} Tage`;
}

const shortDate = new Intl.DateTimeFormat('de', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const withYear = new Intl.DateTimeFormat('de', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const asDate = (day: string) => new Date(`${day}T12:00:00Z`);

/** "27. Nov." (this year) or "27. Nov. 2027". */
export function formatGoalDay(day: string, today: string): string {
  return (day.slice(0, 4) === today.slice(0, 4) ? shortDate : withYear).format(asDate(day));
}

/**
 * "27. Nov. – 24. Dez." (this year), "1. Feb. – 30. Apr. 2027" (another year),
 * "1. Dez. 2026 – 31. Mai 2027" (across years).
 */
export function formatGoalPeriod(startsOn: string, endsOn: string, today: string): string {
  if (startsOn.slice(0, 4) !== endsOn.slice(0, 4)) {
    return `${withYear.format(asDate(startsOn))} – ${withYear.format(asDate(endsOn))}`;
  }
  return `${shortDate.format(asDate(startsOn))} – ${formatGoalDay(endsOn, today)}`;
}

/** A computed value at the precision it is entered in (kg and cm to 0.1, counts whole). */
export function roundGoalValue(value: number, unit: GoalUnit): number {
  const factor = unit === 'kg' || unit === 'cm' || unit === 'per_week' ? 10 : 1;
  return Math.round(value * factor) / factor;
}
