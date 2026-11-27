import type { WeightDay } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;
/** The y axis spans at least this much, so a flat week does not look like a roller coaster. */
const MIN_SPAN_KG = 1;
/** The same for body measurements: a flat line stays flat. */
export const MIN_SPAN_CM = 2;

export interface ChartBox {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface WeightChartLayout {
  /** x of each day (same order as the input). */
  xs: number[];
  y: (kg: number) => number;
  /** Lowest and highest value shown (day values and trend). */
  minKg: number;
  maxKg: number;
}

const time = (day: string) => new Date(`${day}T12:00:00`).getTime();

/** Positions of a series by date, and the y scale around its values. */
export interface TimeChartLayout {
  /** x of each point (same order as the input). */
  xs: number[];
  y: (value: number) => number;
  /** Lowest and highest value given. */
  min: number;
  max: number;
}

/**
 * Points by date (gaps stay gaps), a single one in the middle; the y axis around `values`
 * with a little air and at least `minSpan` high.
 */
export function timeChartLayout(
  dates: readonly string[],
  values: readonly number[],
  box: ChartBox,
  minSpan: number,
): TimeChartLayout | null {
  const first = dates[0];
  const last = dates.at(-1);
  if (first === undefined || last === undefined || values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const air = (max - min) * 0.12;
  let lo = min - air;
  let hi = max + air;
  if (hi - lo < minSpan) {
    const mid = (min + max) / 2;
    lo = mid - minSpan / 2;
    hi = mid + minSpan / 2;
  }
  const plotW = Math.max(1, box.width - box.left - box.right);
  const plotH = Math.max(1, box.height - box.top - box.bottom);
  const t0 = time(first);
  const span = Math.max(DAY_MS, time(last) - t0);
  const xs = dates.map((d) =>
    dates.length === 1 ? box.left + plotW / 2 : box.left + ((time(d) - t0) / span) * plotW,
  );
  return { xs, y: (value) => box.top + (1 - (value - lo) / (hi - lo)) * plotH, min, max };
}

/**
 * Positions for the weight chart: days by date (gaps stay gaps), one day in the middle;
 * the y axis around the values with a little air and at least 1 kg high.
 */
export function weightChartLayout(days: WeightDay[], box: ChartBox): WeightChartLayout | null {
  const layout = timeChartLayout(
    days.map((d) => d.onDate),
    days.flatMap((d) => [d.weightKg, d.trendKg]),
    box,
    MIN_SPAN_KG,
  );
  return layout && { xs: layout.xs, y: layout.y, minKg: layout.min, maxKg: layout.max };
}

/** Index of the x closest to `px` (-1 without points). */
export function nearestIndex(xs: number[], px: number): number {
  let best = -1;
  xs.forEach((x, i) => {
    const current = xs[best];
    if (current === undefined || Math.abs(x - px) < Math.abs(current - px)) best = i;
  });
  return best;
}

/** Dot size by how many days there are: a few stand out, hundreds stay a light texture. */
export function dotRadius(count: number): number {
  return count > 120 ? 1.5 : count > 40 ? 2.5 : 3.5;
}
