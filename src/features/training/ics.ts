/**
 * Calendar files (.ics, RFC 5545) for plans: one date, or a weekly series with its
 * weekdays, end and left-out dates. Times are local ("floating"): the phone's calendar
 * shows them in its own time zone. No reminder (the app pushes; calendars have their own).
 */

export interface IcsEvent {
  uid: string;
  summary: string;
  description?: string | null | undefined;
  /** "2026-11-24" */
  date: string;
  /** "18:00"; null: all day */
  time: string | null;
}

export interface IcsSeries extends IcsEvent {
  /** ISO weekdays (1 = Monday) */
  weekdays: number[];
  /** Last day ("2026-12-31") or null for open-ended. */
  until: string | null;
  /** Planned dates left out (cancelled, or changed and exported on their own). */
  exceptDates: string[];
}

const BYDAY = ['', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
/** Length of a timed entry (a plan has a start, no end). */
const DURATION_MINUTES = 60;

function compact(date: string): string {
  return date.replaceAll('-', '');
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isoWeekday(date: string): number {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

/** "20261124T180000" */
function dateTime(date: string, time: string): string {
  return `${compact(date)}T${time.replace(':', '')}00`;
}

/** Start plus the entry's length, as local date-time. */
function endOf(date: string, time: string): string {
  const [h = 0, m = 0] = time.split(':').map(Number);
  const total = h * 60 + m + DURATION_MINUTES;
  const day = total >= 24 * 60 ? addDays(date, 1) : date;
  const minutes = total % (24 * 60);
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return dateTime(day, `${hh}:${mm}`);
}

function escape(text: string): string {
  return text
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Lines longer than 75 octets are folded (continuation lines start with a space). */
function fold(line: string): string {
  const parts: string[] = [];
  let rest = line;
  // 60 characters stay under 75 octets for most German text (umlauts take two).
  while (rest.length > 60) {
    parts.push(rest.slice(0, 60));
    rest = rest.slice(60);
  }
  parts.push(rest);
  return parts.join('\r\n ');
}

function stamp(now: Date): string {
  return `${now.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;
}

function isSeries(event: IcsEvent | IcsSeries): event is IcsSeries {
  return 'weekdays' in event;
}

/** The first date on or after `from` that falls on one of the weekdays. */
export function firstOn(from: string, weekdays: number[]): string {
  let date = from;
  for (let i = 0; i < 7 && !weekdays.includes(isoWeekday(date)); i++) date = addDays(date, 1);
  return date;
}

function eventLines(event: IcsEvent | IcsSeries, now: Date): string[] {
  const start = isSeries(event) ? firstOn(event.date, event.weekdays) : event.date;
  const lines = [
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${stamp(now)}`,
    `SUMMARY:${escape(event.summary)}`,
  ];
  if (event.time) {
    lines.push(`DTSTART:${dateTime(start, event.time)}`, `DTEND:${endOf(start, event.time)}`);
  } else {
    lines.push(
      `DTSTART;VALUE=DATE:${compact(start)}`,
      `DTEND;VALUE=DATE:${compact(addDays(start, 1))}`,
    );
  }
  if (isSeries(event)) {
    const days = [...event.weekdays]
      .sort()
      .map((d) => BYDAY[d])
      .join(',');
    const until = event.until
      ? `;UNTIL=${event.time ? `${compact(event.until)}T235959` : compact(event.until)}`
      : '';
    lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${days}${until}`);
    for (const date of event.exceptDates) {
      lines.push(
        event.time ? `EXDATE:${dateTime(date, event.time)}` : `EXDATE;VALUE=DATE:${compact(date)}`,
      );
    }
  }
  if (event.description) lines.push(`DESCRIPTION:${escape(event.description)}`);
  lines.push('END:VEVENT');
  return lines;
}

/** A calendar file with the given entries. */
export function buildIcs(events: (IcsEvent | IcsSeries)[], now = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Fitness Challenge//Planung//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events.flatMap((event) => eventLines(event, now)),
    'END:VCALENDAR',
  ];
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

/** Hands the file to the phone: it offers to add the entries to the calendar. */
export function downloadIcs(fileName: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 10_000);
}
