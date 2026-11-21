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

export interface Device {
  id: string;
  name: string;
  weightStep: number | null;
  /** Comparable everywhere (dumbbells, bench, bar) vs. machine. */
  comparable: boolean;
  /** Names of the device's settings, e.g. ["Rückenlehne", "Beinpolster"]; empty: none. */
  settingFields: string[];
}

/** My values per setting field, e.g. { "Rückenlehne": "3" }. */
export type DeviceSettingValues = Record<string, string>;

export interface DeviceWithExercises extends Device {
  exercises: ExerciseSummary[];
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
