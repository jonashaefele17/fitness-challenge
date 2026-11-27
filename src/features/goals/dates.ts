/** Local day as "2026-12-01". */
export function dayKey(date: Date): string {
  return `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function todayKey(): string {
  return dayKey(new Date());
}

/** The phone's time zone (which day a training counts for). */
export function timeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
