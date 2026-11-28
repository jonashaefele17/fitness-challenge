const dayKey = (date: Date) =>
  `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** A day value on the lines' axis: against the trend the person's line starts from, in %. */
export function dayPct(weightKg: number, startTrendKg: number): number {
  return ((weightKg - startTrendKg) / startTrendKg) * 100;
}

/**
 * The training days of a person summed up day by day from `from` to `to` (both included): a
 * point per day, so every line runs over the whole period. Days outside are ignored.
 */
export function cumulativeDays(
  from: string,
  to: string,
  days: readonly string[],
): { onDate: string; value: number }[] {
  const trained = new Set(days);
  const points: { onDate: string; value: number }[] = [];
  let total = 0;
  for (
    const day = new Date(`${from}T12:00:00`);
    dayKey(day) <= to;
    day.setDate(day.getDate() + 1)
  ) {
    const key = dayKey(day);
    if (trained.has(key)) total += 1;
    points.push({ onDate: key, value: total });
  }
  return points;
}
