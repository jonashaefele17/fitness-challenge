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
  /** Zwischenstand every 1 … 12 weeks; null: no rhythm (no Heute card, no reminder). */
  checkinEveryWeeks: number | null;
  /** "08:00" or null (no push; the Heute card still shows when due). */
  checkinReminderAt: string | null;
  /** Keys of the measurement kinds I do not measure (left out of the flow and the view). */
  hiddenMeasurementKinds: string[];
}

/** Ich → Körper: 4 Wochen / 3 Monate / 1 Jahr / Alles. */
export type WeightPeriod = '4w' | '3m' | '1y' | 'all';

// ---------------------------------------------------------------------------
// Zwischenstand (check-in every few weeks)
// ---------------------------------------------------------------------------

/** A body measurement from the global catalogue (body_measurement_kinds). */
export interface MeasurementKind {
  /** "bauch", "taille", … */
  key: string;
  /** "Bauch" */
  label: string;
  /** How and where to measure, one or two short sentences. */
  hint: string;
  /** "cm" */
  unit: string;
  /** Step of the minus/plus buttons (0.5). */
  step: number;
  sort: number;
  /** Storage path of the picture; null until pictures exist. */
  imagePath: string | null;
}

/** Measured values of a check-in by kind key, e.g. { bauch: 84.5, taille: 80 }. */
export type MeasurementValues = Record<string, number>;

/** One Zwischenstand of mine on a day. */
export interface BodyCheckin {
  id: string;
  /** Local day, "2026-12-01". */
  onDate: string;
  /** Skipped for this time: no values, only moves the rhythm on. */
  skipped: boolean;
  values: MeasurementValues;
  createdAt: string;
  updatedAt: string;
}

/** Where my rhythm stands (body_checkin_status). */
export interface CheckinStatus {
  /** Latest check-in, skipped ones included. */
  lastOn: string | null;
  /** Latest check-in that was not skipped. */
  lastDoneOn: string | null;
  /** null: no rhythm. */
  everyWeeks: number | null;
  /** lastOn + weeks; today when there is a rhythm but no check-in yet; null without rhythm. */
  nextDueOn: string | null;
  /** Rhythm set and nextDueOn today or earlier. */
  due: boolean;
  /** nextDueOn − today in days (negative: overdue); null without rhythm. */
  daysUntil: number | null;
}

/** The figures of a kind I have at least one value for (body_measurement_stats). */
export interface MeasurementStat {
  kind: string;
  latestValue: number;
  latestOn: string;
  /** The value before the latest; null with one value. */
  previousValue: number | null;
  previousOn: string | null;
  firstValue: number;
  firstOn: string;
  /** latest − previous; null with one value. */
  changeSincePrevious: number | null;
  /** latest − first; null with one value. */
  changeSinceFirst: number | null;
  valueCount: number;
}

/** A value of a kind over time (body_measurement_history), oldest first. */
export interface MeasurementPoint {
  onDate: string;
  value: number;
  checkinId: string;
}

/** What useSaveCheckin takes (built by newCheckin). */
export interface SaveCheckinInput {
  /** Client-generated for a new check-in; the day's existing one is updated anyway. */
  id: string;
  /** Local day, "2026-12-01". */
  onDate: string;
  /** Exactly the values to keep; kinds left out are removed. Empty: no measurements. */
  values: MeasurementValues;
}
