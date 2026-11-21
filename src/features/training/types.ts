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
  sets: WorkoutSet[];
}

export interface ActiveWorkout {
  id: string;
  startedAt: string;
  pausedAt: string | null;
  pausedSeconds: number;
  trainingType: Pick<TrainingType, 'id' | 'name' | 'kind'>;
  location: Place | null;
  focusId: string | null;
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
