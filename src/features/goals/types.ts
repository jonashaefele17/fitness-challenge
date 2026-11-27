/**
 * Personal goals (8a). Everything computed (current value, progress, the line, status)
 * comes from SQL (goal_progress / goal_history); the frontend only formats it.
 */

/** The metrics of the first stage. More can come as data (goal_metrics), so `metric` is a string. */
export type KnownGoalMetric =
  'trainings_per_week' | 'body_weight' | 'exercise_best' | 'habit_rate' | 'body_measurement';

/**
 * level: a value that moves from a start to a target (weight 85 → 80);
 * rate: how often, judged per week or day (3 trainings a week, a habit on 90 % of days).
 */
export type GoalMetricKind = 'level' | 'rate';

/** What a goal points at. */
export type GoalReferenceKind = 'exercise' | 'habit' | 'measurement';

/** Unit code of a goal's values. */
export type GoalUnit = 'kg' | 'cm' | 'reps' | 'seconds' | 'percent' | 'per_week';

/** A metric from the catalogue (goal_metrics). */
export interface GoalMetric {
  key: string;
  label: string;
  /** One sentence for the goal editor. */
  description: string;
  kind: GoalMetricKind;
  /** null: the goal points at nothing (trainings, weight). */
  reference: GoalReferenceKind | null;
  /** null: from the reference (exercise measure, measurement kind). */
  unit: GoalUnit | null;
  sort: number;
  /** false: no new goals of it (retired, e.g. the habit quota); old ones still read. */
  offered: boolean;
}

/** Which exercise / habit / measurement kind a goal is about (the one fitting the metric). */
export interface GoalReference {
  exerciseId: string | null;
  /** With an exercise: only this device (its history scope); null: all devices. */
  deviceId: string | null;
  habitId: string | null;
  measurementKind: string | null;
}

/**
 * With a minimum: target_reached / min_reached / below_min. Without: target_reached /
 * not_reached.
 */
export type GoalStatus = 'target_reached' | 'min_reached' | 'below_min' | 'not_reached';

/** upcoming: starts later · running · ended (values frozen at the last day). */
export type GoalPhase = 'upcoming' | 'running' | 'ended';

/** A week (or a history point) of a goal: its status, or still open / all paused. */
export type GoalPointState = GoalStatus | 'open' | 'paused';

export type GoalVisibility = 'private' | 'shared';

/** The best set behind an exercise goal's value (null for other metrics). */
export interface GoalBestSet {
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
}

/** A goal with its figures as of `evaluatedOn` (goal_progress). */
export interface Goal {
  id: string;
  userId: string;
  metric: string;
  metricLabel: string;
  metricKind: GoalMetricKind;
  unit: GoalUnit;
  reference: GoalReference;
  /** Exercise name, habit name or measurement label; null without a reference. */
  referenceLabel: string | null;
  /** With a device: "Brustpresse · FitX Neuperlach". */
  referenceDetail: string | null;
  /** Weight exercises: the values are kg at this many reps. */
  reps: number | null;
  startsOn: string;
  endsOn: string;
  visibility: GoalVisibility;
  archivedAt: string | null;
  createdAt: string;
  /**
   * kg / cm left out for me (someone else's weight not shared in kg, or a body measurement):
   * start, min, target, current, expected and the best set are null; progress, status and
   * on track stay.
   */
  valuesHidden: boolean;
  /** Today, or the last day once the goal is over. */
  evaluatedOn: string;
  phase: GoalPhase;
  /** Levels: where the line starts. Rates: the baseline before (may be null). */
  startValue: number | null;
  /** The version valid on evaluatedOn; null: no minimum. */
  minValue: number | null;
  targetValue: number | null;
  /**
   * Levels: weight trend / best set / latest check-in since the start. Trainings: average
   * per judged week. Habit: the quota in % since the start. null: nothing yet.
   */
  currentValue: number | null;
  /** The day the current value is from (levels). */
  currentOn: string | null;
  /** Levels: where the straight line from start to target is on evaluatedOn. */
  expectedValue: number | null;
  /**
   * Levels: how far from start to target (may be below 0 or above 100). Rates: done against
   * what the target asked for (100 = target reached).
   */
  progressPct: number | null;
  /** null: nothing to judge yet (no value, no finished week). */
  status: GoalStatus | null;
  /** "Auf Kurs" (true) / "hinter Plan" (false); null: nothing to judge yet. */
  onTrack: boolean | null;
  /** Rates: judged weeks (trainings) or days / weeks counted (habit). */
  counted: number | null;
  /** Trainings with a minimum: weeks that reached it. */
  minMet: number | null;
  /** Rates: weeks (trainings) or days / weeks (habit) that reached the target. */
  targetMet: number | null;
  countUnit: 'weeks' | 'days' | null;
  /** Trainings: the running week so far (null when there is none). */
  thisWeek: { done: number; min: number | null; target: number } | null;
  bestSet: GoalBestSet | null;
}

/** A point of a goal's course (goal_history). */
export interface GoalHistoryPoint {
  /** Levels: the day of the value. Rates: the Monday of the week. */
  onDate: string;
  /** null when values are hidden from me (or nothing counted that week). */
  value: number | null;
  /** The rule valid then (trainings: what that week asked for, shrunk by pauses). */
  minValue: number | null;
  targetValue: number | null;
  /** Levels: the line from start to target that day. */
  expectedValue: number | null;
  progressPct: number | null;
  state: GoalPointState | null;
}

/** A suggested start value for a new goal (goal_start_suggestion). */
export interface GoalStartSuggestion {
  /** null: no data to suggest from. */
  value: number | null;
  /** The day it is from (levels). */
  onDate: string | null;
  /** Weight exercises: the rep count the value is at (the best set's own when not given). */
  reps: number | null;
  bestSet: GoalBestSet | null;
}

/** What useGoalStartSuggestion takes. */
export interface GoalStartSuggestionInput {
  metric: string;
  reference?: Partial<GoalReference>;
  /** Weight exercises: kg at this many reps; default: the best set's own reps. */
  reps?: number | null;
}

/** Something a goal of a metric can point at, for the goal editor (goal_reference_options). */
export interface GoalReferenceOption {
  reference: GoalReference;
  label: string;
  /** With a device: "device · place". */
  detail: string | null;
  unit: GoalUnit;
  /** Weight exercises: the goal needs a rep count. */
  needsReps: boolean;
  /** When I last did, answered or measured it. */
  lastUsedOn: string | null;
}

/**
 * How a frame outside this module (8b: a season of a group) marks one of my goals. The app
 * works it out and passes it in; the goals module only shows it.
 */
export interface GoalFrame {
  /** Short tag next to the title ("Saison"). */
  tag: string;
  /** Its name in the detail ("Saison „Winterform“"). */
  name: string;
  /** Period and visibility come from the frame: not editable here. */
  periodFixed: boolean;
  /** Locked: no editing or ending, this one line says why instead. null: not locked. */
  lockedNote: string | null;
}

/**
 * A create flow inside a frame (8b: the season setup): period and visibility are given (their
 * screens are left out), optionally the metric too (the flow starts at what it is about).
 */
export interface GoalCreatePreset {
  metric?: string;
  startsOn: string;
  endsOn: string;
  visibility: GoalVisibility;
}

/** What useCreateGoal takes. */
export interface CreateGoalInput {
  /** Client-generated (crypto.randomUUID()). */
  id: string;
  metric: string;
  reference: GoalReference;
  /** Weight exercises only. */
  reps: number | null;
  startsOn: string;
  endsOn: string;
  /** Required for levels; optional for rates. */
  startValue: number | null;
  minValue: number | null;
  targetValue: number;
  visibility: GoalVisibility;
}

/**
 * What useUpdateGoal takes: the full new state. Period, start value and visibility change as
 * they are; min and target get a new version from validFrom (default today).
 */
export interface UpdateGoalInput {
  goalId: string;
  startsOn: string;
  endsOn: string;
  startValue: number | null;
  minValue: number | null;
  targetValue: number;
  visibility: GoalVisibility;
  validFrom?: string;
}
