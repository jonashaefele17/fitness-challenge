/** Date, start time and duration as entered (strings, so the fields stay editable). */
export interface When {
  /** "2026-11-21" */
  date: string;
  /** "18:00" */
  time: string;
  minutes: string;
}

const pad = (value: number) => String(value).padStart(2, '0');

export function whenFrom(start: Date, durationSeconds: number | null): When {
  return {
    date: `${String(start.getFullYear())}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    time: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
    minutes: durationSeconds === null ? '' : String(Math.round(durationSeconds / 60)),
  };
}

/** The start as a Date and the duration in minutes, or what is missing. */
export function parseWhen(when: When, now: Date = new Date()) {
  const start = new Date(`${when.date}T${when.time || '00:00'}:00`);
  const minutes = Number(when.minutes.replace(',', '.'));
  const missing = Number.isNaN(start.getTime())
    ? 'Wähl einen Tag und eine Uhrzeit.'
    : start > now
      ? 'Der Start liegt in der Zukunft.'
      : !Number.isFinite(minutes) || minutes < 1 || minutes > 1440
        ? 'Trag die Dauer in Minuten ein.'
        : null;
  return { start, minutes, missing };
}
