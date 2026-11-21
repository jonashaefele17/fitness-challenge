import { dayKey } from '../../calendar';
import type { CalendarWorkout } from '../../types';

/** One person's line in the log (me, or a group mate in "Gruppe"). */
export interface LogRow {
  id: string;
  initial: string;
  name: string;
  /** CSS colour of their marks. */
  color: string;
  workouts: CalendarWorkout[];
}

export const ACCENT = 'var(--color-accent)';
export const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export const dayTitle = new Intl.DateTimeFormat('de', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
export const monthTitle = new Intl.DateTimeFormat('de', { month: 'long', year: 'numeric' });

/** Strength first (it shapes the training plan), then by time. */
export function forPlan(workouts: CalendarWorkout[]): CalendarWorkout[] {
  return [...workouts].sort(
    (a, b) =>
      Number(b.trainingType.kind === 'exercises') - Number(a.trainingType.kind === 'exercises') ||
      a.startedAt.localeCompare(b.startedAt),
  );
}

/** Workouts per local day, each day in plan order. */
export function byDay(workouts: CalendarWorkout[]): Map<string, CalendarWorkout[]> {
  const map = new Map<string, CalendarWorkout[]>();
  for (const workout of workouts) {
    const key = dayKey(new Date(workout.startedAt));
    map.set(key, [...(map.get(key) ?? []), workout]);
  }
  for (const [key, list] of map) map.set(key, forPlan(list));
  return map;
}

/** Remembered per-viewer setting; storage may be unavailable (private mode). */
export function readSetting(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeSetting(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Remembering is a convenience only.
  }
}
