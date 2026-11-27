import type { Goal, GoalHistoryPoint, GoalUnit } from './types';
import { addDays, daysBetween } from './view';

/** SVG box of a chart in px: size and the room left for labels on each side. */
export interface ChartBox {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** The y axis spans at least this much, so a flat course does not look like a roller coaster. */
const MIN_SPAN: Record<GoalUnit, number> = {
  kg: 1,
  cm: 2,
  reps: 2,
  seconds: 10,
  percent: 10,
  per_week: 1,
};

export interface LevelChartScale {
  /** x of a day: the period from start (left) to end (right). */
  x: (day: string) => number;
  y: (value: number) => number;
  /** Lowest and highest value of the axis (with a little air). */
  lo: number;
  hi: number;
}

/**
 * Levels: the whole period on the x axis (what is left of it stays empty), the y axis
 * around the values, start, minimum and target.
 */
export function levelChartScale(
  goal: Pick<Goal, 'startsOn' | 'endsOn' | 'startValue' | 'minValue' | 'targetValue' | 'unit'>,
  points: readonly GoalHistoryPoint[],
  box: ChartBox,
): LevelChartScale | null {
  const values = [
    ...points.flatMap((p) => (p.value === null ? [] : [p.value])),
    ...[goal.startValue, goal.minValue, goal.targetValue].filter((v): v is number => v !== null),
  ];
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const air = (max - min) * 0.1;
  let lo = min - air;
  let hi = max + air;
  const span = MIN_SPAN[goal.unit];
  if (hi - lo < span) {
    const mid = (min + max) / 2;
    lo = mid - span / 2;
    hi = mid + span / 2;
  }
  const plotW = Math.max(1, box.width - box.left - box.right);
  const plotH = Math.max(1, box.height - box.top - box.bottom);
  const days = Math.max(1, daysBetween(goal.startsOn, goal.endsOn));
  return {
    x: (day) =>
      box.left + (Math.min(days, Math.max(0, daysBetween(goal.startsOn, day))) / days) * plotW,
    y: (value) => box.top + (1 - (value - lo) / (hi - lo)) * plotH,
    lo,
    hi,
  };
}

/** A week of a rate goal: its history point, or none yet (still to come). */
export interface RateWeek {
  /** Monday of the week. */
  weekStart: string;
  point: GoalHistoryPoint | null;
}

/** Monday of the week a day lies in. */
export function mondayOf(day: string): string {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  return addDays(day, -((weekday + 6) % 7));
}

/** Every week of the period (Mondays), each with its point from the history if there is one. */
export function rateWeeks(
  goal: Pick<Goal, 'startsOn' | 'endsOn'>,
  points: readonly GoalHistoryPoint[],
): RateWeek[] {
  const byWeek = new Map(points.map((p) => [p.onDate, p]));
  const weeks: RateWeek[] = [];
  for (let week = mondayOf(goal.startsOn); week <= goal.endsOn; week = addDays(week, 7)) {
    weeks.push({ weekStart: week, point: byWeek.get(week) ?? null });
  }
  return weeks;
}

export interface BarChartScale {
  /** Left edge and width of each bar slot (same order as the weeks). */
  bars: { x: number; width: number }[];
  /** Centre of each slot (for picking). */
  xs: number[];
  y: (value: number) => number;
  /** Top of the axis. */
  hi: number;
}

/** Rates: one bar per week from 0 up; the axis reaches a bit above the target. */
export function barChartScale(
  weeks: readonly RateWeek[],
  target: number | null,
  box: ChartBox,
): BarChartScale {
  const values = weeks.flatMap((w) =>
    [w.point?.value, w.point?.targetValue, w.point?.minValue].filter(
      (v): v is number => v !== null && v !== undefined,
    ),
  );
  const hi = Math.max(1, target ?? 0, ...values) * 1.1;
  const plotW = Math.max(1, box.width - box.left - box.right);
  const plotH = Math.max(1, box.height - box.top - box.bottom);
  const slot = plotW / Math.max(1, weeks.length);
  const gap = Math.min(6, slot * 0.3);
  const bars = weeks.map((_, i) => ({ x: box.left + i * slot + gap / 2, width: slot - gap }));
  return {
    bars,
    xs: bars.map((b) => b.x + b.width / 2),
    y: (value) => box.top + (1 - value / hi) * plotH,
    hi,
  };
}

/** Index of the x closest to `px` (-1 without points). */
export function nearestIndex(xs: readonly number[], px: number): number {
  let best = -1;
  xs.forEach((x, i) => {
    const current = xs[best];
    if (current === undefined || Math.abs(x - px) < Math.abs(current - px)) best = i;
  });
  return best;
}
