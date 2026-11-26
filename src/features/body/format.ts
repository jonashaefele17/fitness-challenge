import type { BodySettings, WeightPeriod } from './types';

const oneDecimal = new Intl.NumberFormat('de', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** 80.25 → "80,3"; null → "–" (always one decimal). */
export function formatKg(value: number | null): string {
  return value === null ? '–' : oneDecimal.format(value);
}

/** Signed change: -0.74 → "−0,7", 0.3 → "+0,3", 0 → "±0,0". */
export function formatSignedKg(value: number | null): string {
  return value === null ? '–' : signed(value);
}

/** Signed percent: -0.91 → "−0,9 %", 1.25 → "+1,3 %". */
export function formatPercentChange(value: number | null): string {
  return value === null ? '–' : `${signed(value)} %`;
}

function signed(value: number): string {
  const text = oneDecimal.format(Math.abs(value));
  // Rounded to zero counts as no change (no "−0,0").
  if (text === oneDecimal.format(0)) return `±${text}`;
  return `${value < 0 ? '−' : '+'}${text}`;
}

/** "80,3" / "80.3" / " 80 " → 80.3; anything else → null. One decimal at most. */
export function parseKg(input: string): number | null {
  const text = input.trim().replace(',', '.');
  if (!/^\d{1,3}(\.\d)?$/.test(text)) return null;
  const value = Number(text);
  return value >= 20 && value <= 400 ? value : null;
}

/** Local day as "2026-12-01". */
export function dayKey(date: Date): string {
  return `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function todayKey(): string {
  return dayKey(new Date());
}

/** The range of a period ending today; "all" has no start (null). */
export function periodRange(
  period: WeightPeriod,
  today: string = todayKey(),
): { from: string | null; to: string } {
  const date = new Date(`${today}T12:00:00`);
  switch (period) {
    case '4w':
      date.setDate(date.getDate() - 27);
      break;
    case '3m':
      date.setMonth(date.getMonth() - 3);
      date.setDate(date.getDate() + 1);
      break;
    case '1y':
      date.setFullYear(date.getFullYear() - 1);
      date.setDate(date.getDate() + 1);
      break;
    case 'all':
      return { from: null, to: today };
  }
  return { from: dayKey(date), to: today };
}

/** ±0,1 kg steps in the weigh-in: "80,3" + 0.1 → "80,4"; unreadable input stays as it is. */
export function stepKg(input: string, delta: number): string {
  const value = parseKg(input);
  if (value === null) return input;
  const next = Math.round((value + delta) * 10) / 10;
  return parseKg(String(next)) === null ? input : formatKg(next);
}

/**
 * How much a scale shows more or less than the main scale (the amount only, the direction is
 * chosen separately: the iPhone's decimal keypad has no minus). "0,6" → 0.6; 0 … 20.
 */
export function parseOffsetAmount(input: string): number | null {
  const text = input.trim().replace(',', '.');
  if (!/^\d{1,2}(\.\d)?$/.test(text)) return null;
  const value = Number(text);
  return value <= 20 ? value : null;
}

/** A scale's offset in words: "zeigt 0,6 kg mehr als die Hauptwaage". */
export function offsetText(offsetKg: number): string {
  const amount = formatKg(Math.abs(offsetKg));
  if (amount === formatKg(0)) return 'zeigt dasselbe wie die Hauptwaage';
  return `zeigt ${amount} kg ${offsetKg > 0 ? 'mehr' : 'weniger'} als die Hauptwaage`;
}

/** Same offset to one decimal (what the person sees). */
export function sameOffset(a: number, b: number): boolean {
  return formatKg(a) === formatKg(b) || formatKg(Math.abs(a - b)) === formatKg(0);
}

/** ISO weekday of a local day: 1 = Monday … 7 = Sunday. */
export function isoWeekday(day: string): number {
  return ((new Date(`${day}T12:00:00`).getDay() + 6) % 7) + 1;
}

/**
 * The time to store for an entry on `day`: now for today, else that day at the current
 * clock time (so entries of a day sort as they were made).
 */
export function measuredAtFor(day: string, now: Date = new Date()): string {
  if (day === dayKey(now)) return now.toISOString();
  const [y, m, d] = day.split('-').map(Number);
  const at = new Date(now);
  at.setFullYear(y ?? at.getFullYear(), (m ?? 1) - 1, d ?? 1);
  return at.toISOString();
}

/** Short weekday names, Monday first (index + 1 = ISO weekday). */
export const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;

/** The reminder in one line: "Mo, Do · 07:00" or "Aus". */
export function reminderSummary(settings: BodySettings | undefined): string {
  if (!settings || settings.weighReminderDays.length === 0) return 'Aus';
  const days = settings.weighReminderDays.map((d) => WEEKDAYS[d - 1] ?? '').join(', ');
  return settings.weighReminderAt ? `${days} · ${settings.weighReminderAt}` : days;
}

function addDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() + days);
  return dayKey(date);
}

/** How far back the Heute card has to look: the last weigh day is at most 6 days ago. */
export function weighWindowStart(today: string): string {
  return addDays(today, -6);
}

export interface WeighDue {
  /** The weigh day this is about (today or the missed one). */
  day: string;
  missed: boolean;
}

/**
 * Whether weighing is open on Heute: on a weigh day until there is an entry, and on the
 * days after a missed one until I weigh myself (any day counts), skip it, or the next
 * weigh day comes. `skippedDay` is the weigh day I chose to leave out.
 */
export function weighDue(
  today: string,
  reminderDays: readonly number[],
  entryDays: readonly string[],
  skippedDay: string | null,
): WeighDue | null {
  for (let back = 0; back < 7; back += 1) {
    const day = addDays(today, -back);
    if (!reminderDays.includes(isoWeekday(day))) continue;
    if (day === skippedDay) return null;
    if (entryDays.some((entry) => entry >= day && entry <= today)) return null;
    return { day, missed: back > 0 };
  }
  return null;
}
