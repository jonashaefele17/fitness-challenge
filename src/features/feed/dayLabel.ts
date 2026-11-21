const weekdayDate = new Intl.DateTimeFormat('de', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

function localKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${String(date.getFullYear())}-${month}-${day}`;
}

/** "Heute", "Gestern" or "Mo., 16. Nov." for a day card ("2026-11-16"). */
export function dayLabel(day: string, now: Date = new Date()): string {
  if (day === localKey(now)) return 'Heute';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (day === localKey(yesterday)) return 'Gestern';
  return weekdayDate.format(new Date(`${day}T12:00:00`));
}
