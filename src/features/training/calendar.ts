/** Calendar helpers in local time; weeks start on Monday (German convention). */

export type CalendarView = 'month' | 'week';

/** "2026-11-21" for a local date. */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${String(y)}-${m}-${d}`;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Same day of month where possible (31 Jan + 1 month → 28/29 Feb). */
export function addMonths(date: Date, months: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), lastDay));
}

/** Monday of the week containing the date. */
export function startOfWeek(date: Date): Date {
  const weekday = (date.getDay() + 6) % 7; // Monday = 0
  return addDays(startOfDay(date), -weekday);
}

/** The seven days of the week containing the date. */
export function weekDays(date: Date): Date[] {
  const monday = startOfWeek(date);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

/** Full weeks (Monday–Sunday) covering the month of the date: 4–6 rows of 7 days. */
export function monthGrid(date: Date): Date[][] {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const weeks: Date[][] = [];
  for (let monday = startOfWeek(first); monday <= last; monday = addDays(monday, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, index) => addDays(monday, index)));
  }
  return weeks;
}

/** Visible range [from, to) of a view, for loading workouts. */
export function visibleRange(view: CalendarView, date: Date): { from: Date; to: Date } {
  if (view === 'week') {
    const from = startOfWeek(date);
    return { from, to: addDays(from, 7) };
  }
  const weeks = monthGrid(date);
  const from = weeks[0]?.[0] ?? startOfDay(date);
  const lastWeek = weeks.at(-1);
  return { from, to: addDays(lastWeek?.[6] ?? from, 1) };
}

/** ISO week number (KW). */
export function isoWeek(date: Date): number {
  const thursday = addDays(startOfWeek(date), 3);
  const firstThursday = addDays(startOfWeek(new Date(thursday.getFullYear(), 0, 4)), 3);
  return 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
}
