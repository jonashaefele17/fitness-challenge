import type { ExerciseSummary, TemplateItem } from '../../types';

/** Timing set once for the whole routine (stored on each exercise of the template). */
export interface RoutineTiming {
  seconds: number;
  restSeconds: number;
  rounds: number;
}

export const DEFAULT_TIMING: RoutineTiming = { seconds: 45, restSeconds: 15, rounds: 1 };

/** The routine's timing as stored on its first exercise (all share it). */
export function timingOf(items: TemplateItem[]): RoutineTiming {
  const first = items[0];
  if (!first) return DEFAULT_TIMING;
  return {
    seconds: first.durationSeconds ?? DEFAULT_TIMING.seconds,
    restSeconds: first.restSeconds,
    rounds: first.sets,
  };
}

export function withTiming(items: TemplateItem[], timing: RoutineTiming): TemplateItem[] {
  return items.map((item) => ({
    ...item,
    durationSeconds: timing.seconds,
    restSeconds: timing.restSeconds,
    sets: timing.rounds,
  }));
}

export function routineItem(exercise: ExerciseSummary, timing: RoutineTiming): TemplateItem {
  return {
    exercise,
    deviceType: null,
    sets: timing.rounds,
    warmupSets: 0,
    repMin: null,
    repMax: null,
    durationSeconds: timing.seconds,
    note: null,
    restSeconds: timing.restSeconds,
    perSide: false,
    sideRestSeconds: 0,
  };
}

/** Total length in seconds (the player skips the rest after the very last exercise). */
export function routineSeconds(items: TemplateItem[], timing: RoutineTiming): number {
  if (items.length === 0) return 0;
  const round = items.reduce(
    (sum, item) =>
      sum +
      timing.seconds * (item.perSide ? 2 : 1) +
      (item.perSide ? item.sideRestSeconds : 0) +
      timing.restSeconds,
    0,
  );
  return timing.rounds * round - timing.restSeconds;
}
