import type { WorkoutItem } from './types';

/** Fallback seconds per round when a routine exercise has no target time. */
export const DEFAULT_ROUND_SECONDS = 30;

export interface RoutineStep {
  kind: 'exercise' | 'rest';
  itemId: string;
  /** The set this step fills in (exercise steps). */
  setId: string | null;
  /** Exercise name, "Pause" or "Seite wechseln". */
  name: string;
  /** How-to of the exercise (exercise steps). */
  instructions: string | null;
  side: 'left' | 'right' | null;
  seconds: number;
  /** 1-based round of the routine and how many there are. */
  round: number;
  rounds: number;
}

/**
 * The guided order of a routine, like a follow-along video: round by round through the
 * whole list (A B C, A B C). A both-sides exercise runs left, then right (with its
 * switch pause in between when set); the rest follows each exercise – except after the
 * very last step.
 */
export function routineSteps(items: WorkoutItem[]): RoutineStep[] {
  const plans = [...items]
    .sort((a, b) => a.position - b.position)
    .map((item) => {
      const sets = item.sets.filter((set) => !set.isWarmup).sort((a, b) => a.position - b.position);
      const perRound = item.perSide ? 2 : 1;
      return { item, sets, perRound, rounds: Math.ceil(sets.length / perRound) };
    });
  const rounds = Math.max(0, ...plans.map((plan) => plan.rounds));
  const steps: RoutineStep[] = [];
  const rest = (itemId: string, name: string, seconds: number, round: number) => {
    steps.push({
      kind: 'rest',
      itemId,
      setId: null,
      name,
      instructions: null,
      side: null,
      seconds,
      round,
      rounds,
    });
  };

  for (let round = 0; round < rounds; round++) {
    for (const { item, sets, perRound } of plans) {
      const seconds = item.targetSeconds ?? DEFAULT_ROUND_SECONDS;
      let added = false;
      for (let side = 0; side < perRound; side++) {
        const set = sets[round * perRound + side];
        if (!set) continue;
        if (side === 1 && added && item.sideRestSeconds > 0) {
          rest(item.id, 'Seite wechseln', item.sideRestSeconds, round + 1);
        }
        steps.push({
          kind: 'exercise',
          itemId: item.id,
          setId: set.id,
          name: item.exercise.name,
          instructions: item.exercise.instructions ?? null,
          side: item.perSide ? (side === 0 ? 'left' : 'right') : null,
          seconds,
          round: round + 1,
          rounds,
        });
        added = true;
      }
      if (added && item.restSeconds > 0) rest(item.id, 'Pause', item.restSeconds, round + 1);
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
