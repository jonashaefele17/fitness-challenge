/** Local day as "2026-11-24". */
export function dayKey(date: Date): string {
  return `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function todayKey(): string {
  return dayKey(new Date());
}

/** "2026-11-24" plus n days. */
export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() + days);
  return dayKey(date);
}

/** The phone's time zone (which day a training counts for). */
export function timeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** 135 → "2:15 h", 45 → "45 min" */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${String(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h)}:${String(m).padStart(2, '0')} h`;
}
