import type { WeightDay } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;
/** The y axis spans at least this much, so a flat week does not look like a roller coaster. */
const MIN_SPAN_KG = 1;

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

/**
 * Positions for the weight chart: days by date (gaps stay gaps), one day in the middle;
 * the y axis around the values with a little air and at least 1 kg high.
 */
export function weightChartLayout(days: WeightDay[], box: ChartBox): WeightChartLayout | null {
  const first = days[0];
  const last = days.at(-1);
  if (!first || !last) return null;
  const values = days.flatMap((d) => [d.weightKg, d.trendKg]);
  const minKg = Math.min(...values);
  const maxKg = Math.max(...values);
  const air = (maxKg - minKg) * 0.12;
  let lo = minKg - air;
  let hi = maxKg + air;
  if (hi - lo < MIN_SPAN_KG) {
    const mid = (minKg + maxKg) / 2;
    lo = mid - MIN_SPAN_KG / 2;
    hi = mid + MIN_SPAN_KG / 2;
  }
  const plotW = Math.max(1, box.width - box.left - box.right);
  const plotH = Math.max(1, box.height - box.top - box.bottom);
  const t0 = time(first.onDate);
  const span = Math.max(DAY_MS, time(last.onDate) - t0);
  const xs = days.map((d) =>
    days.length === 1 ? box.left + plotW / 2 : box.left + ((time(d.onDate) - t0) / span) * plotW,
  );
  return {
    xs,
    y: (kg) => box.top + (1 - (kg - lo) / (hi - lo)) * plotH,
    minKg,
    maxKg,
  };
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
