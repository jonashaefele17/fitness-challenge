/** Calendar helpers in local time; weeks start on Monday (German convention). */

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

/** ISO week number (KW). */
export function isoWeek(date: Date): number {
  const thursday = addDays(startOfWeek(date), 3);
  const firstThursday = addDays(startOfWeek(new Date(thursday.getFullYear(), 0, 4)), 3);
  return 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
}

/** First day of the month containing the date. */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** First day of the month n months later (or earlier). */
export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

/** Mondays of all weeks (Monday–Sunday) that touch the month: 4–6 weeks. */
export function monthWeeks(date: Date): Date[] {
  const first = startOfMonth(date);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const mondays: Date[] = [];
  for (let monday = startOfWeek(first); monday <= last; monday = addDays(monday, 7)) {
    mondays.push(monday);
  }
  return mondays;
}
