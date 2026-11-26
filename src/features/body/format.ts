import type { WeightPeriod } from './types';

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
