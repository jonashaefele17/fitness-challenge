export type ExerciseMeasure = 'weight_reps' | 'reps' | 'duration';
export type TrainingKind = 'exercises' | 'duration';

export interface TrainingType {
  id: string;
  name: string;
  kind: TrainingKind;
  withDistance: boolean;
  /** Personal type of the signed-in user (null for defaults). */
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
  deviceId: string | null;
  sets: WorkoutSet[];
}

export interface ActiveWorkout {
  id: string;
  startedAt: string;
  pausedAt: string | null;
  pausedSeconds: number;
  trainingType: Pick<TrainingType, 'id' | 'name' | 'kind'>;
  items: WorkoutItem[];
}

export interface PreviousSet {
  position: number;
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
  isWarmup: boolean;
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
}
