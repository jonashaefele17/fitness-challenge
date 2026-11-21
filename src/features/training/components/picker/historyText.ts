import { formatRelativeTime } from '@/shared/lib';
import type { ExerciseHistory } from '../../api/useCatalog';
import { formatSet } from '../../format';
import type { ExerciseSummary } from '../../types';

/** "vor 2 Tagen · 40 kg × 10" */
export function lastDoneText(history: ExerciseHistory, exercise: ExerciseSummary): string {
  const set = {
    weightKg: history.lastWeightKg,
    reps: history.lastReps,
    durationSeconds: history.lastDurationSeconds,
  };
  return `${formatRelativeTime(history.lastDoneAt)} · ${formatSet(exercise.measure, set)}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const months = new Intl.RelativeTimeFormat('de', { numeric: 'auto' });

/** "zuletzt vor 4 Monaten" for exercises done long ago. */
export function longAgoText(iso: string, now: number = Date.now()): string {
  const days = (now - new Date(iso).getTime()) / DAY_MS;
  return `zuletzt ${months.format(-Math.max(1, Math.round(days / 30)), 'month')}`;
}
