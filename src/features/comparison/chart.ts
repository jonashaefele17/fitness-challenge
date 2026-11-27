const DAY_MS = 24 * 60 * 60 * 1000;
/** The y axis spans at least this many percentage points, so tiny changes stay flat. */
const MIN_SPAN_PCT = 2;

export interface ChartBox {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** A person's line: days with entries, change of the 7-day trend in % (first day 0). */
export interface PercentSeries {
  key: string;
  days: readonly { onDate: string; changePct: number }[];
}

export interface PercentChartLayout {
  /** Every day any line has a point on, oldest first, and its x. */
  dates: string[];
  xs: number[];
  x: (day: string) => number;
  y: (pct: number) => number;
  /** Lowest and highest value of all lines (0 included). */
  minPct: number;
  maxPct: number;
}

const time = (day: string) => new Date(`${day}T12:00:00`).getTime();

/**
 * Positions for several % lines on one axis: x by date over all lines (one date in the
 * middle), y around all values and the zero line with a little air, at least 2 points high.
 * null without any point.
 */
export function percentChartLayout(
  series: readonly PercentSeries[],
  box: ChartBox,
  /** Further values that must fit on the axis (day dots around the lines). */
  alsoPct: readonly number[] = [],
): PercentChartLayout | null {
  const dates = [...new Set(series.flatMap((s) => s.days.map((d) => d.onDate)))].sort();
  const first = dates[0];
  const last = dates.at(-1);
  if (!first || !last) return null;
  const values = [0, ...series.flatMap((s) => s.days.map((d) => d.changePct))];
  const minPct = Math.min(...values);
  const maxPct = Math.max(...values);
  const low = Math.min(minPct, ...alsoPct);
  const high = Math.max(maxPct, ...alsoPct);
  const air = (high - low) * 0.12;
  let lo = low - air;
  let hi = high + air;
  if (hi - lo < MIN_SPAN_PCT) {
    const mid = (low + high) / 2;
    lo = mid - MIN_SPAN_PCT / 2;
    hi = mid + MIN_SPAN_PCT / 2;
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
    y: (pct) => box.top + (1 - (pct - lo) / (hi - lo)) * plotH,
    minPct,
    maxPct,
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

/** A day value on the lines' axis: against the trend the person's line starts from, in %. */
export function dayPct(weightKg: number, startTrendKg: number): number {
  return ((weightKg - startTrendKg) / startTrendKg) * 100;
}
