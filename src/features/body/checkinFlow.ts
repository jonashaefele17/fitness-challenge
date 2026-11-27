import type {
  BodyCheckin,
  MeasurementKind,
  MeasurementPoint,
  MeasurementStat,
  MeasurementValues,
} from './types';
import { visibleKinds } from './checkin';

/**
 * The screens of a Zwischenstand, in order: one per measurement I take, then the summary.
 * A later step (photos) goes in before the summary.
 */
export type CheckinStep = { type: 'measure'; kind: MeasurementKind } | { type: 'summary' };

/**
 * How far a person got with a measurement in the flow: a value (confirmed with "Weiter" or
 * moved on the wheel), null (left out), or missing (not answered yet).
 */
export type CheckinAnswers = Record<string, number | null>;

/** A value of a kind from an earlier (or later) check-in, offered on the wheel. */
export interface SuggestedValue {
  value: number;
  onDate: string;
}

/** The steps for my visible kinds in catalogue order, the summary last. */
export function checkinSteps(
  kinds: readonly MeasurementKind[],
  hidden: readonly string[],
): CheckinStep[] {
  return [
    ...visibleKinds(kinds, hidden).map((kind) => ({ type: 'measure' as const, kind })),
    { type: 'summary' },
  ];
}

/** The measurement steps only. */
export function measureSteps(steps: readonly CheckinStep[]): MeasurementKind[] {
  return steps.flatMap((step) => (step.type === 'measure' ? [step.kind] : []));
}

const withValues = (checkins: readonly BodyCheckin[]) =>
  checkins.filter((c) => !c.skipped).sort((a, b) => a.onDate.localeCompare(b.onDate));

/**
 * What the wheel offers per kind for a check-in on `onDate`: the value of the latest
 * check-in on or before that day that has the kind; for a day before all of them, the
 * nearest later one.
 */
export function suggestedValues(
  checkins: readonly BodyCheckin[],
  onDate: string,
): Record<string, SuggestedValue> {
  const result: Record<string, SuggestedValue> = {};
  const sorted = withValues(checkins);
  // Later ones first, so that the ones on or before the day overwrite them (nearest wins).
  for (const c of [...sorted].reverse()) {
    if (c.onDate <= onDate) continue;
    for (const [kind, value] of Object.entries(c.values))
      result[kind] = { value, onDate: c.onDate };
  }
  for (const c of sorted) {
    if (c.onDate > onDate) break;
    for (const [kind, value] of Object.entries(c.values))
      result[kind] = { value, onDate: c.onDate };
  }
  return result;
}

/** Per kind the value of the latest check-in before `onDate` that has it (for the summary). */
export function previousValues(
  checkins: readonly BodyCheckin[],
  onDate: string,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const c of withValues(checkins)) {
    if (c.onDate >= onDate) break;
    Object.assign(result, c.values);
  }
  return result;
}

/**
 * The answers a flow starts with: none for a new check-in; for an existing one, its value
 * per visible kind and "left out" for the kinds it does not have.
 */
export function initialAnswers(
  checkin: BodyCheckin | null,
  steps: readonly CheckinStep[],
): CheckinAnswers {
  if (!checkin) return {};
  return Object.fromEntries(measureSteps(steps).map((k) => [k.key, checkin.values[k.key] ?? null]));
}

/**
 * The value a measurement ends with when leaving its screen: "Weiter" takes what the wheel
 * shows – my own value, else the suggested one (measurements often stay the same) – and
 * without anything to show leaves it out like "Überspringen" does.
 */
export function stepResult(
  answer: number | null | undefined,
  suggestion: number | null | undefined,
  action: 'next' | 'skip',
): number | null {
  if (action === 'skip') return null;
  return answer ?? suggestion ?? null;
}

/**
 * What the wheel shows for a kind: my answer (confirmed), else the suggestion (greyed), else
 * nothing ("–"). A kind I left out shows the suggestion again, greyed.
 */
export function wheelValue(
  answer: number | null | undefined,
  suggestion: number | null | undefined,
): { value: number | null; suggested: boolean } {
  if (typeof answer === 'number') return { value: answer, suggested: false };
  return { value: suggestion ?? null, suggested: true };
}

/**
 * The values to save: the answered visible kinds, plus the values of an existing check-in for
 * kinds I have hidden since (hiding a kind must not delete what was measured back then).
 */
export function checkinValues(
  steps: readonly CheckinStep[],
  answers: CheckinAnswers,
  existing: BodyCheckin | null,
): MeasurementValues {
  const asked = new Set(measureSteps(steps).map((k) => k.key));
  const values: MeasurementValues = {};
  for (const [kind, value] of Object.entries(existing?.values ?? {})) {
    if (!asked.has(kind)) values[kind] = value;
  }
  for (const key of asked) {
    const value = answers[key];
    if (typeof value === 'number') values[key] = value;
  }
  return values;
}

export interface SummaryRow {
  kind: MeasurementKind;
  /** null: left out this time. */
  value: number | null;
  /** Against the previous check-in that has this kind; null without one or without value. */
  change: number | null;
}

/** One row per measurement step, in step order. */
export function summaryRows(
  steps: readonly CheckinStep[],
  answers: CheckinAnswers,
  previous: Record<string, number>,
): SummaryRow[] {
  return measureSteps(steps).map((kind) => {
    const value = answers[kind.key];
    const before = previous[kind.key];
    const has = typeof value === 'number';
    return {
      kind,
      value: has ? value : null,
      change: has && before !== undefined ? Math.round((value - before) * 10) / 10 : null,
    };
  });
}

/** Something was entered or changed (closing asks before throwing it away). */
export function answersChanged(initial: CheckinAnswers, answers: CheckinAnswers): boolean {
  const keys = new Set([...Object.keys(initial), ...Object.keys(answers)]);
  for (const key of keys) {
    const before = initial[key] ?? null;
    const after = answers[key] ?? null;
    if (before !== after) return true;
  }
  return false;
}

/** Ich → Körper: my visible kinds that have a value, with their figures (catalogue order). */
export function measurementRows(
  kinds: readonly MeasurementKind[],
  hidden: readonly string[],
  stats: readonly MeasurementStat[],
): { kind: MeasurementKind; stat: MeasurementStat }[] {
  return visibleKinds(kinds, hidden).flatMap((kind) => {
    const stat = stats.find((s) => s.kind === kind.key);
    return stat ? [{ kind, stat }] : [];
  });
}

/** A kind's values over time from my check-ins, oldest first (for the small curves). */
export function kindHistory(checkins: readonly BodyCheckin[], key: string): MeasurementPoint[] {
  return withValues(checkins).flatMap((c) => {
    const value = c.values[key];
    return value === undefined ? [] : [{ onDate: c.onDate, value, checkinId: c.id }];
  });
}
