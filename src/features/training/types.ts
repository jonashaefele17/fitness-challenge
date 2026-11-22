export type ExerciseMeasure = 'weight_reps' | 'reps' | 'duration';
export type TrainingKind = 'exercises' | 'duration';

export interface TrainingType {
  id: string;
  name: string;
  kind: TrainingKind;
  withDistance: boolean;
  /** Personal type of the signed-in user (null for defaults). */
  ownerId: string | null;
  /** Default place: home studio, own private place, or none. */
  locationMode: 'home_studio' | 'private' | 'none';
  /** e.g. Outdoor / Laufband */
  variants: string[];
  /** Key of the line icon (barbell, home_gym, run …). */
  icon: string;
  /** Guided: the phone leads through a routine (Mobility player). */
  guided: boolean;
  /** Exercise catalogue the type's exercises come from. */
  catalog: ExerciseCatalog;
  /** Focuses that make sense for the type; null: all. */
  focusIds: string[] | null;
}

export type ExerciseCatalog = 'strength' | 'mobility';

export interface Place {
  id: string;
  name: string;
  /** Private place of the signed-in user (e.g. Home Gym). */
  private: boolean;
}

/** A device at a place: an instance of a device type (Kabelturm at FitX Neuperlach Süd). */
export interface Device {
  id: string;
  typeId: string;
  /** Name of the device type. */
  name: string;
  /** Effective weight step: own override or the type's default. */
  weightStep: number | null;
  /** The type's default step (an override equal to it is not stored). */
  typeWeightStep: number | null;
  /** Comparable everywhere (dumbbells, bench, bar) vs. machine. */
  comparable: boolean;
  /** Names of the type's settings, e.g. ["Rückenlehne", "Beinpolster"]; empty: none. */
  settingFields: string[];
}

/** My values per setting field, e.g. { "Rückenlehne": "3" }. */
export type DeviceSettingValues = Record<string, string>;

export interface DeviceWithExercises extends Device {
  /** Exercises of the type offered here. */
  exercises: ExerciseSummary[];
  /** Exercises of the type this place does not offer ("nicht verfügbar"). */
  hiddenExercises: ExerciseSummary[];
  /** Exercises I linked to the type myself (I may remove those links again). */
  ownLinks: string[];
}

/** Global device class with its exercises (catalogue for setting up a place). */
export interface DeviceType {
  id: string;
  name: string;
  weightStep: number | null;
  comparable: boolean;
  settingFields: string[];
  exercises: ExerciseSummary[];
}

/** Push, Pull, Beine … or a personal one: a set of muscle groups. */
export interface TrainingFocus {
  id: string;
  name: string;
  /** ≤ 5 characters for calendar cells (Push, OK, GK …). */
  shortName: string;
  muscleGroups: string[];
  /** Personal focus of the signed-in user (null for defaults). */
  ownerId: string | null;
}

export interface ExerciseSummary {
  id: string;
  name: string;
  measure: ExerciseMeasure;
  matchedAlias?: string | null;
  /** Short how-to (guided routines show it in the player). */
  instructions?: string | null;
}

export interface WorkoutSet {
  id: string;
  position: number;
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
  isWarmup: boolean;
  completedAt: string | null;
}

export interface WorkoutItem {
  id: string;
  position: number;
  note: string | null;
  exercise: ExerciseSummary;
  device: Device | null;
  /** Target rep range (from the template); null: none set. */
  repMin: number | null;
  repMax: number | null;
  /** Guided routines: seconds per round, rest afterwards, left and right. */
  targetSeconds: number | null;
  restSeconds: number;
  perSide: boolean;
  /** Guided routines: pause to switch from left to right. */
  sideRestSeconds: number;
  sets: WorkoutSet[];
}

export interface ActiveWorkout {
  id: string;
  startedAt: string;
  /** Set once finished (edit mode). */
  endedAt: string | null;
  /** Duration-type entries; else derived from start, end and pauses. */
  durationSeconds: number | null;
  pausedAt: string | null;
  pausedSeconds: number;
  trainingType: Pick<
    TrainingType,
    'id' | 'name' | 'kind' | 'icon' | 'guided' | 'catalog' | 'focusIds'
  >;
  location: Place | null;
  focusId: string | null;
  /** Template the workout was started with. */
  templateId: string | null;
  /** The plan date it was started from (its planned date). */
  plan: { id: string; onDate: string } | null;
  items: WorkoutItem[];
}

export interface PreviousSet {
  position: number;
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
  isWarmup: boolean;
  /** False when the values come from another device (orientation only). */
  sameDevice: boolean;
}

export interface TrendPoint {
  startedAt: string;
  value: number;
}

export interface DurationEntryInput {
  trainingTypeId: string;
  durationMinutes: number;
  distanceKm?: number | undefined;
  intensity?: number | undefined;
  note?: string | undefined;
  variant?: string | undefined;
}

export interface SetValues {
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
}

/** One workout in an exercise's history. */
export interface ExerciseSession {
  workoutId: string;
  startedAt: string;
  locationName: string | null;
  deviceName: string | null;
  /** Best working set (by estimated 1RM, reps or time). */
  best: SetValues | null;
  /** Its score: only for ordering and drawing, never shown as a number. */
  score: number | null;
  /** kg × reps of the working sets (weight exercises only). */
  volumeKg: number | null;
  sets: (SetValues & { isWarmup: boolean })[];
}

export interface ExerciseRecords {
  best: (SetValues & { achievedAt: string }) | null;
  heaviest: (SetValues & { achievedAt: string }) | null;
  volume: { volumeKg: number; achievedAt: string } | null;
  /** Most reps per weight, heaviest first. */
  repsAtWeight: { weightKg: number; reps: number; achievedAt: string }[];
}

/** A finished workout as shown in the calendar. */
export interface CalendarWorkout {
  id: string;
  userId: string;
  startedAt: string;
  /** Active time (duration workouts: as entered; others: end − start − pauses). */
  durationSeconds: number | null;
  trainingType: Pick<TrainingType, 'id' | 'name' | 'kind' | 'icon'>;
  variant: string | null;
  focus: { id: string; name: string; shortName: string } | null;
  locationName: string | null;
  distanceM: number | null;
  exerciseCount: number;
}

/** A finished workout with everything for the detail view. */
export interface WorkoutDetailData extends CalendarWorkout {
  endedAt: string | null;
  intensity: number | null;
  note: string | null;
  templateId: string | null;
  items: WorkoutItem[];
}

/** A template I can use (mine, or a group mate's I may see). */
export interface TemplateSummary {
  id: string;
  ownerId: string;
  ownerName: string | null;
  mine: boolean;
  name: string;
  trainingTypeId: string;
  focusId: string | null;
  note: string | null;
  archivedAt: string | null;
  exerciseCount: number;
  myLastUsedAt: string | null;
  ownerLastUsedAt: string | null;
}

export interface TemplateItem {
  exercise: ExerciseSummary;
  /** Device class (works in any studio); null: no device. */
  deviceType: { id: string; name: string } | null;
  sets: number;
  warmupSets: number;
  repMin: number | null;
  repMax: number | null;
  /** Target time per set for duration exercises. */
  durationSeconds: number | null;
  note: string | null;
  /** Guided routines: rest after the exercise, left/right rounds and the switch pause. */
  restSeconds: number;
  perSide: boolean;
  sideRestSeconds: number;
}

export interface TemplateDraft {
  id: string | null;
  name: string;
  trainingTypeId: string;
  focusId: string | null;
  note: string;
  items: TemplateItem[];
}

/** A finished workout in a few numbers, for cards elsewhere (e.g. the feed). */
export interface WorkoutCardSummary {
  id: string;
  userId: string;
  trainingType: {
    id: string;
    name: string;
    icon: string;
    kind: 'exercises' | 'duration';
    guided: boolean;
  };
  focusName: string | null;
  variant: string | null;
  locationName: string | null;
  startedAt: string;
  durationSeconds: number | null;
  distanceM: number | null;
  exerciseCount: number;
  workingSets: number;
  volumeKg: number;
  /** Exercise names in order. */
  exerciseNames: string[];
  /** Exercises with a new best set. */
  recordCount: number;
}

/** One date of a plan (a single plan or one of a weekly series). */
export interface PlanOccurrence {
  planId: string;
  userId: string;
  /** Where it shows, "2026-12-07" (moved or not). */
  onDate: string;
  /** The date as planned: key for cancelling, changing and "done". */
  planDate: string;
  /** "18:00", or null for no fixed time. */
  startTime: string | null;
  kind: 'training' | 'event';
  trainingType: { id: string; name: string; icon: string } | null;
  focus: { id: string; name: string; shortName: string | null } | null;
  /** Templates to choose from at the start (one: starts with it). */
  templateIds: string[];
  title: string | null;
  note: string | null;
  recurring: boolean;
  /** This date was changed on its own. */
  changed: boolean;
  status: 'planned' | 'cancelled' | 'done';
  /** The finished workout started from it (status done). */
  workoutId: string | null;
}

/** Focus and templates of one weekday of a series (instead of the plan's). */
export interface PlanDay {
  /** ISO weekday 1–7. */
  weekday: number;
  focusId: string | null;
  templateIds: string[];
}

/** A plan as edited in the form. */
export interface PlanDraft {
  id: string | null;
  kind: 'training' | 'event';
  trainingTypeId: string | null;
  focusId: string | null;
  templateIds: string[];
  title: string;
  note: string;
  /** "2026-12-07" */
  startsOn: string;
  /** "18:00" or "" (no fixed time). */
  startTime: string;
  /** ISO weekdays 1–7; empty: once. */
  repeatWeekdays: number[];
  /** "2026-12-31" or "" (open ended). */
  repeatUntil: string;
  /** Series: weekdays with their own focus and templates. */
  days: PlanDay[];
}

/** "Nur diesen Termin ändern": what differs on one date. */
export interface PlanChange {
  planId: string;
  planDate: string;
  /** "2026-12-08", or the planned date. */
  onDate: string;
  /** "07:00" or "" (no fixed time). */
  startTime: string;
  focusId: string | null;
  templateIds: string[];
}
