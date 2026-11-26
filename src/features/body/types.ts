/** manual (entered) | external (later through a personal key) */
export type WeighInSource = 'manual' | 'external';

/** A person's scale. Offsets say how much MORE it shows than the main scale (main: 0). */
export interface Scale {
  id: string;
  name: string;
  isMain: boolean;
  offsetKg: number;
  archived: boolean;
  createdAt: string;
}

/** One weigh-in as entered (the offset is applied in the computed figures only). */
export interface WeighIn {
  id: string;
  /** null: no scale given, counts as the main scale. */
  scaleId: string | null;
  /** Local day it counts for, "2026-12-01". */
  measuredOn: string;
  /** ISO timestamp. */
  measuredAt: string;
  weightKg: number;
  source: WeighInSource;
}

/** A day with entries (weight_days). */
export interface WeightDay {
  onDate: string;
  /** Average of the day's entries, offsets taken off. */
  weightKg: number;
  entries: number;
  /** Average of the day values of the 7 days ending that day. */
  trendKg: number;
}

/** The figures of a range (weight_summary); nulls without data. */
export interface WeightSummary {
  /** Trend of the latest day with entries ("aktueller Wert"). */
  currentTrendKg: number | null;
  currentOn: string | null;
  /** Trend of the first day with entries in the range. */
  startTrendKg: number | null;
  startOn: string | null;
  changeKg: number | null;
  /** Percent of the start, e.g. -0.91. */
  changePct: number | null;
  /** Latest single entry as entered, with its offset taken off, its scale and day. */
  latestKg: number | null;
  latestAdjustedKg: number | null;
  latestScaleId: string | null;
  latestOn: string | null;
  daysWithEntries: number;
}

/** Suggested offset of a non-main scale from the days weighed on both. */
export interface ScaleOffsetSuggestion {
  scaleId: string;
  /** This scale minus the main scale; null without common days. */
  suggestedOffsetKg: number | null;
  commonDays: number;
}

export interface BodySettings {
  /** ISO weekdays (1 = Monday) to be reminded on; empty: no reminder. */
  weighReminderDays: number[];
  /** "07:00" or null. */
  weighReminderAt: string | null;
}

/** Ich → Körper: 4 Wochen / 3 Monate / 1 Jahr / Alles. */
export type WeightPeriod = '4w' | '3m' | '1y' | 'all';
