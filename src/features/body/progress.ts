import { addDays } from './format';
import type { WeightProgressDay, WeightWeek } from './types';

const round2 = (value: number) => Math.round(value * 100) / 100;

/** The days weightWeek needs: the 4 weeks ending with the week, and the week before them. */
export function weightWeekRange(weekStart: string): { from: string; to: string } {
  return { from: addDays(weekStart, -28), to: addDays(weekStart, 6) };
}

/** Change from day a to day b in %: from the kg trend when there is one, else from the %. */
function changePct(a: WeightProgressDay, b: WeightProgressDay): number {
  if (a.trendKg !== null && b.trendKg !== null && a.trendKg !== 0) {
    return round2(((b.trendKg - a.trendKg) / a.trendKg) * 100);
  }
  // Both % are against the same first day of the range.
  return round2(((100 + b.changePct) / (100 + a.changePct) - 1) * 100);
}

function changeKg(a: WeightProgressDay, b: WeightProgressDay): number | null {
  return a.trendKg !== null && b.trendKg !== null ? round2(b.trendKg - a.trendKg) : null;
}

/**
 * Someone's week from their curve (weightWeekRange): the latest day with entries in the
 * week against a base day. Base: the latest day in the 7 days before the span (week or
 * 4 weeks); without one, the first day within the span before the latest one; else no
 * change (null). null when there is no day with entries in the week (or nothing shared).
 */
export function weightWeek(
  days: readonly WeightProgressDay[],
  weekStart: string,
): WeightWeek | null {
  const weekEnd = addDays(weekStart, 6);
  const sorted = [...days].sort((a, b) => a.onDate.localeCompare(b.onDate));
  const end = sorted.findLast((d) => d.onDate >= weekStart && d.onDate <= weekEnd);
  if (!end) return null;
  const base = (spanStart: string) =>
    sorted.findLast((d) => d.onDate >= addDays(spanStart, -7) && d.onDate < spanStart) ??
    sorted.find((d) => d.onDate >= spanStart && d.onDate < end.onDate) ??
    null;
  const week = base(weekStart);
  const four = base(addDays(weekStart, -21));
  return {
    weekStart,
    weekEnd,
    weekPct: week ? changePct(week, end) : null,
    weekKg: week ? changeKg(week, end) : null,
    fourWeeksPct: four ? changePct(four, end) : null,
    fourWeeksKg: four ? changeKg(four, end) : null,
  };
}
