const DAY_MS = 24 * 60 * 60 * 1000;
/** A % axis spans at least this many percentage points, so tiny changes stay flat. */
const MIN_SPAN_PCT = 2;
/** A count axis reaches at least this high, so a few days do not fill the whole height. */
const MIN_SPAN_COUNT = 4;
/** The top of a progress axis (100 %). */
const PROGRESS_MAX = 100;

export interface ChartBox {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** A point of a line: a day and its value on the chart's axis. */
export interface LinePoint {
  onDate: string;
  value: number;
}

/**
 * percent: change in %, the axis around all values and zero with a little air on both sides.
 * count: a number from zero up, zero at the bottom.
 * progress: a share from 0 to 100 %, the axis fixed to exactly that.
 */
export type LineAxis = 'percent' | 'count' | 'progress';

export interface LineChartLayout {
  /** Every day any line has a point on, oldest first, and its x. */
  dates: string[];
  xs: number[];
  x: (day: string) => number;
  y: (value: number) => number;
  /** Lowest and highest value of all lines (0 included); progress: 0 and 100. */
  min: number;
  max: number;
}

const time = (day: string) => new Date(`${day}T12:00:00`).getTime();

/**
 * Positions for several lines on one axis: x by date over all lines (one date in the
 * middle), y around all values and zero (see LineAxis). null without any point.
 */
export function lineChartLayout(
  series: readonly { points: readonly LinePoint[] }[],
  box: ChartBox,
  axis: LineAxis,
  /** Further values that must fit on the axis (day dots around the lines). */
  alsoValues: readonly number[] = [],
): LineChartLayout | null {
  const dates = [...new Set(series.flatMap((s) => s.points.map((p) => p.onDate)))].sort();
  const first = dates[0];
  const last = dates.at(-1);
  if (!first || !last) return null;
  const values = [0, ...series.flatMap((s) => s.points.map((p) => p.value))];
  const min = axis === 'progress' ? 0 : Math.min(...values);
  const max = axis === 'progress' ? PROGRESS_MAX : Math.max(...values);
  const low = Math.min(min, ...alsoValues);
  const high = Math.max(max, ...alsoValues);
  const air = (high - low) * 0.12;
  let lo: number;
  let hi: number;
  if (axis === 'progress') {
    lo = 0;
    hi = PROGRESS_MAX;
  } else if (axis === 'count') {
    lo = low;
    hi = Math.max(high + air, lo + MIN_SPAN_COUNT);
  } else {
    lo = low - air;
    hi = high + air;
    if (hi - lo < MIN_SPAN_PCT) {
      const mid = (low + high) / 2;
      lo = mid - MIN_SPAN_PCT / 2;
      hi = mid + MIN_SPAN_PCT / 2;
    }
  }
  const plotW = Math.max(1, box.width - box.left - box.right);
  const plotH = Math.max(1, box.height - box.top - box.bottom);
  const t0 = time(first);
  const span = Math.max(DAY_MS, time(last) - t0);
  const x = (day: string) =>
    dates.length === 1 ? box.left + plotW / 2 : box.left + ((time(day) - t0) / span) * plotW;
  return {
    dates,
    xs: dates.map(x),
    x,
    y: (value) => box.top + (1 - (value - lo) / (hi - lo)) * plotH,
    min,
    max,
  };
}

/**
 * A line's value on a day: its latest point up to that day, while the line runs (null
 * before its first and after its last point).
 */
export function valueOn<T extends { onDate: string }>(days: readonly T[], day: string): T | null {
  const first = days[0];
  const last = days.at(-1);
  if (!first || !last || day < first.onDate || day > last.onDate) return null;
  return days.findLast((d) => d.onDate <= day) ?? null;
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
