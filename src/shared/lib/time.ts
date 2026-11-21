const relative = new Intl.RelativeTimeFormat('de', { numeric: 'auto' });
const dateFormat = new Intl.DateTimeFormat('de', { day: 'numeric', month: 'short' });

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Short German relative time: "gerade eben", "vor 5 Minuten", "gestern", "12. Nov.". */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return 'gerade eben';
  if (abs < HOUR) return relative.format(Math.round(seconds / MINUTE), 'minute');
  if (abs < DAY) return relative.format(Math.round(seconds / HOUR), 'hour');
  if (abs < 7 * DAY) return relative.format(Math.round(seconds / DAY), 'day');
  return dateFormat.format(new Date(iso));
}
