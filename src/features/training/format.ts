import type { ExerciseMeasure, PreviousSet, WorkoutItem, WorkoutSet } from './types';

const kgFormat = new Intl.NumberFormat('de', { maximumFractionDigits: 2 });

/** "72,5" */
export function formatKg(value: number | null): string {
  return value === null ? '–' : kgFormat.format(value);
}

/** 75 → "1:15", 3725 → "1:02:05" */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${String(h)}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

/** Short text for a set, e.g. "72,5 × 8", "12 Wdh.", "+10 × 8", "0:45". */
export function formatSet(
  measure: ExerciseMeasure,
  set: Pick<WorkoutSet, 'weightKg' | 'reps' | 'durationSeconds'> | PreviousSet,
): string {
  switch (measure) {
    case 'weight_reps':
      return `${formatKg(set.weightKg)} × ${set.reps === null ? '–' : String(set.reps)}`;
    case 'reps':
      return set.weightKg
        ? `+${formatKg(set.weightKg)} × ${set.reps === null ? '–' : String(set.reps)}`
        : `${set.reps === null ? '–' : String(set.reps)} Wdh.`;
    case 'duration':
      return set.durationSeconds === null ? '–' : formatDuration(set.durationSeconds);
  }
}

/** Elapsed active time of a workout in seconds (pauses excluded). */
export function elapsedSeconds(
  workout: { startedAt: string; pausedAt: string | null; pausedSeconds: number },
  now: number = Date.now(),
): number {
  const end = workout.pausedAt ? new Date(workout.pausedAt).getTime() : now;
  return Math.max(0, (end - new Date(workout.startedAt).getTime()) / 1000 - workout.pausedSeconds);
}

export interface WorkoutSummary {
  workingSets: number;
  /** kg, weight × reps of working sets */
  volumeKg: number;
  exercises: number;
}

/** Working sets and volume (warm-ups and unticked sets excluded). */
export function summarize(items: WorkoutItem[]): WorkoutSummary {
  let workingSets = 0;
  let volumeKg = 0;
  let exercises = 0;
  for (const item of items) {
    const done = item.sets.filter((set) => set.completedAt !== null && !set.isWarmup);
    if (item.sets.some((set) => set.completedAt !== null)) exercises++;
    workingSets += done.length;
    for (const set of done) volumeKg += (set.weightKg ?? 0) * (set.reps ?? 0);
  }
  return { workingSets, volumeKg, exercises };
}
