import { formatKg, formatSignedKg } from './format';
import type {
  BodyCheckin,
  BodySettings,
  CheckinStatus,
  MeasurementKind,
  MeasurementValues,
  SaveCheckinInput,
} from './types';

/** Newest first. */
export function byNewestCheckin(a: BodyCheckin, b: BodyCheckin): number {
  return b.onDate.localeCompare(a.onDate);
}

/** My check-in of a day, if any (at most one per day). */
export function checkinOn(checkins: readonly BodyCheckin[], day: string): BodyCheckin | undefined {
  return checkins.find((c) => c.onDate === day);
}

/**
 * The input for useSaveCheckin().mutate: the id of that day's check-in, or a new one. Also
 * returns the check-in it replaces (null: a new one), which is what "Rückgängig" needs.
 */
export function newCheckin(
  checkins: readonly BodyCheckin[],
  onDate: string,
  values: MeasurementValues,
  makeId: () => string = () => crypto.randomUUID(),
): { input: SaveCheckinInput; previous: BodyCheckin | null } {
  const previous = checkinOn(checkins, onDate) ?? null;
  return { input: { id: previous?.id ?? makeId(), onDate, values }, previous };
}

/** 84.5 → "84,5"; null → "–" (always one decimal). */
export function formatCm(value: number | null): string {
  return formatKg(value);
}

/** Signed change: -1.5 → "−1,5 cm", 0.5 → "+0,5 cm", 0 → "±0,0 cm"; null → "–". */
export function formatSignedCm(value: number | null): string {
  return value === null ? '–' : `${formatSignedKg(value)} cm`;
}

/** "84,5" / "84.5" / " 84 " → 84.5; anything else or outside 10 … 300 → null. */
export function parseCm(input: string): number | null {
  const text = input.trim().replace(',', '.');
  if (!/^\d{1,3}(\.\d)?$/.test(text)) return null;
  const value = Number(text);
  return value >= 10 && value <= 300 ? value : null;
}

/**
 * When the next Zwischenstand is due, in words: "in 12 Tagen", "morgen", "heute fällig",
 * "seit gestern fällig", "seit 3 Tagen fällig"; null without a rhythm.
 */
export function checkinDueText(status: Pick<CheckinStatus, 'daysUntil'>): string | null {
  const days = status.daysUntil;
  if (days === null) return null;
  if (days === 0) return 'heute fällig';
  if (days === 1) return 'morgen';
  if (days > 1) return `in ${String(days)} Tagen`;
  if (days === -1) return 'seit gestern fällig';
  return `seit ${String(-days)} Tagen fällig`;
}

/** The rhythm in one line: "Alle 4 Wochen · 08:00", "Jede Woche", or "Aus". */
export function checkinRhythmSummary(
  settings: Pick<BodySettings, 'checkinEveryWeeks' | 'checkinReminderAt'> | undefined,
): string {
  const weeks = settings?.checkinEveryWeeks ?? null;
  if (weeks === null) return 'Aus';
  const rhythm = weeks === 1 ? 'Jede Woche' : `Alle ${String(weeks)} Wochen`;
  return settings?.checkinReminderAt ? `${rhythm} · ${settings.checkinReminderAt}` : rhythm;
}

/** The kinds I measure (catalogue order kept). */
export function visibleKinds(
  kinds: readonly MeasurementKind[],
  hidden: readonly string[],
): MeasurementKind[] {
  return kinds.filter((kind) => !hidden.includes(kind.key));
}
