import { describe, expect, it } from 'vitest';
import { routineItem, routineSeconds, timingOf, withTiming } from './routineDraft';

const exercise = (id: string) => ({ id, name: id, measure: 'duration' as const });

describe('routine draft', () => {
  it('applies the routine timing to every exercise and reads it back', () => {
    const timing = { seconds: 30, restSeconds: 10, rounds: 2 };
    const items = withTiming(
      [routineItem(exercise('a'), { seconds: 45, restSeconds: 15, rounds: 1 })],
      timing,
    );
    expect(timingOf(items)).toEqual(timing);
  });

  it('adds both sides and the switch pause to the length, without the last rest', () => {
    const timing = { seconds: 30, restSeconds: 10, rounds: 2 };
    const items = [
      routineItem(exercise('a'), timing),
      { ...routineItem(exercise('b'), timing), perSide: true, sideRestSeconds: 5 },
    ];
    // Round: a 30 + rest 10 + b 30·2 + switch 5 + rest 10 = 115; two rounds minus last rest.
    expect(routineSeconds(items, timing)).toBe(220);
  });
});
