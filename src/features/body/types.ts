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
  /** Days with entries in the range; 0 for other people (never shown to them). */
  daysWithEntries: number;
  /**
   * What I see of this person: "own" (it is me), "kg", "percent", or null (nothing: not
   * shared, no common group or nobody – looks the same as no data). For others the
   * database leaves out what is not shared: with "percent" every kg value and the latest
   * entry are null, with "kg" still the latest entry.
   */
  share: WeightShareView | null;
}

/**
 * Ich → Körper → Sichtbarkeit, for all my groups: nothing (default) / only % / the 7-day
 * trend in kg / also the unsmoothed day values.
 */
export type WeightShare = 'private' | 'percent' | 'kg' | 'days';

/** What the viewer gets of a person's weight (weight_summary.share). */
export type WeightShareView = 'own' | 'days' | 'kg' | 'percent';

/** A day of someone's curve (weight_progress): the 7-day trend, never single entries. */
export interface WeightProgressDay {
  onDate: string;
  /** Trend against the first day with entries in the range, in %; first day 0. */
  changePct: number;
  /** Trend in kg; null unless it is me or the person shares in kg. */
  trendKg: number | null;
  /** The day's unsmoothed value in kg; null unless it is me or the person shares days. */
  weightKg: number | null;
}

/**
 * Someone's week (feed card "Gewicht"): how the trend moved this week and over the 4 weeks
 * ending with it. kg values only when shared in kg (or me).
 */
export interface WeightWeek {
  /** Monday, "2026-12-07". */
  weekStart: string;
  /** Sunday. */
  weekEnd: string;
  /**
   * Trend of the latest day of the week against the latest day of the week before (none:
   * the first day of this week), in %; null without a day to compare with.
   */
  weekPct: number | null;
  weekKg: number | null;
  /** The same over the 4 weeks ending with this week (base: the week before them). */
  fourWeeksPct: number | null;
  fourWeeksKg: number | null;
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
  /** Who sees my weight (the people I share a group with); default private. */
  weightShare: WeightShare;
}

/** Ich → Körper: 4 Wochen / 3 Monate / 1 Jahr / Alles. */
export type WeightPeriod = '4w' | '3m' | '1y' | 'all';
