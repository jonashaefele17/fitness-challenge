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

/** A person's habit quota in a calendar week (0 … 100). */
export interface HabitWeek {
  userId: string;
  /** The week's Monday. */
  weekStart: string;
  quotaPct: number;
}

/**
 * The weekly quota lines: one per person who has a week that counted, in the given order
 * (me first), a point per week on its Monday, oldest first.
 */
export function habitWeekLines(
  weeks: readonly HabitWeek[],
  people: readonly { userId: string; name: string; color: string }[],
): { key: string; name: string; color: string; points: { onDate: string; value: number }[] }[] {
  return people.flatMap((person) => {
    const points = weeks
      .filter((w) => w.userId === person.userId)
      .map((w) => ({ onDate: w.weekStart, value: w.quotaPct }))
      .sort((a, b) => a.onDate.localeCompare(b.onDate));
    return points.length > 0
      ? [{ key: person.userId, name: person.name, color: person.color, points }]
      : [];
  });
}
