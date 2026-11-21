import type { WorkoutItem } from './types';

/** Fallback seconds per round when a routine exercise has no target time. */
export const DEFAULT_ROUND_SECONDS = 30;

export interface RoutineStep {
  kind: 'exercise' | 'rest';
  itemId: string;
  /** The set this step fills in (exercise steps). */
  setId: string | null;
  name: string;
  side: 'left' | 'right' | null;
  seconds: number;
  /** 1-based round of the exercise and how many there are. */
  round: number;
  rounds: number;
}

/**
 * The guided order of a routine: each exercise round by round (both-sides rounds as left,
 * then right), a rest after every round when set – except after the very last step.
 */
export function routineSteps(items: WorkoutItem[]): RoutineStep[] {
  const steps: RoutineStep[] = [];
  for (const item of [...items].sort((a, b) => a.position - b.position)) {
    const sets = item.sets.filter((set) => !set.isWarmup).sort((a, b) => a.position - b.position);
    const perRound = item.perSide ? 2 : 1;
    const rounds = Math.ceil(sets.length / perRound);
    const seconds = item.targetSeconds ?? DEFAULT_ROUND_SECONDS;
    for (let round = 0; round < rounds; round++) {
      for (let side = 0; side < perRound; side++) {
        const set = sets[round * perRound + side];
        if (!set) continue;
        steps.push({
          kind: 'exercise',
          itemId: item.id,
          setId: set.id,
          name: item.exercise.name,
          side: item.perSide ? (side === 0 ? 'left' : 'right') : null,
          seconds,
          round: round + 1,
          rounds,
        });
      }
      if (item.restSeconds > 0) {
        steps.push({
          kind: 'rest',
          itemId: item.id,
          setId: null,
          name: 'Pause',
          side: null,
          seconds: item.restSeconds,
          round: round + 1,
          rounds,
        });
      }
    }
  }
  while (steps.at(-1)?.kind === 'rest') steps.pop();
  return steps;
}

/** Where to (re)start: the first exercise step whose set is not done yet. */
export function firstOpenStep(steps: RoutineStep[], doneSetIds: Set<string>): number {
  const index = steps.findIndex(
    (step) => step.kind === 'exercise' && step.setId !== null && !doneSetIds.has(step.setId),
  );
  return index === -1 ? steps.length : index;
}
