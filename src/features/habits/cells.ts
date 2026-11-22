import { addDays } from './dates';
import type { HabitDay } from './types';

/** Monday of the week a day is in. */
export function mondayOf(day: string): string {
  const weekday = (new Date(`${day}T12:00:00`).getDay() + 6) % 7;
  return addDays(day, -weekday);
}

export function percent(quota: number | null): string {
  return quota === null ? '–' : `${String(Math.round(quota * 100))} %`;
}

/** A day's square: met, partly, missed, pause, not due. */
export function cellClass(day: HabitDay | undefined): string {
  switch (day?.state) {
    case 'done':
      return 'bg-accent';
    case 'partial':
      return 'bg-accent/45';
    case 'missed':
      return 'bg-surface-3';
    case 'open':
      return 'border border-border bg-transparent';
    case 'paused':
      return 'border border-dashed border-text-subtle';
    default:
      return 'bg-transparent';
  }
}
