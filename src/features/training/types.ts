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
}

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
  sets: WorkoutSet[];
}

export interface ActiveWorkout {
  id: string;
  startedAt: string;
  pausedAt: string | null;
  pausedSeconds: number;
  trainingType: Pick<TrainingType, 'id' | 'name' | 'kind' | 'guided'>;
  location: Place | null;
  focusId: string | null;
  /** Template the workout was started with. */
  templateId: string | null;
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
  /** Guided routines: rest after the exercise, and left/right rounds. */
  restSeconds: number;
  perSide: boolean;
}

export interface TemplateDraft {
  id: string | null;
  name: string;
  trainingTypeId: string;
  focusId: string | null;
  note: string;
  items: TemplateItem[];
}
