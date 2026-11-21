import { describe, expect, it } from 'vitest';
import { firstOpenStep, routineSteps } from './routine';
import type { WorkoutItem, WorkoutSet } from './types';

const set = (id: string, position: number, done = false): WorkoutSet => ({
  id,
  position,
  weightKg: null,
  reps: null,
  durationSeconds: null,
  isWarmup: false,
  completedAt: done ? '2026-11-21T10:00:00Z' : null,
});

function item(overrides: Partial<WorkoutItem>): WorkoutItem {
  return {
    id: 'i',
    position: 0,
    note: null,
    exercise: { id: 'e', name: 'Dehnen', measure: 'duration' },
    device: null,
    repMin: null,
    repMax: null,
    targetSeconds: 45,
    restSeconds: 0,
    perSide: false,
    sideRestSeconds: 0,
    sets: [],
    ...overrides,
  };
}

describe('routineSteps', () => {
  it('runs both-sides rounds left then right, with rest after each round but not at the end', () => {
    const steps = routineSteps([
      item({
        id: 'a',
        perSide: true,
        restSeconds: 15,
        sets: [set('a1', 0), set('a2', 1), set('a3', 2), set('a4', 3)],
      }),
    ]);
    expect(steps.map((s) => `${s.kind}:${s.side ?? '-'}:${String(s.round)}`)).toEqual([
      'exercise:left:1',
      'exercise:right:1',
      'rest:-:1',
      'exercise:left:2',
      'exercise:right:2',
    ]);
    expect(steps[0]?.seconds).toBe(45);
    expect(steps[2]?.seconds).toBe(15);
  });

  it('goes round by round through the whole list, like a follow-along video', () => {
    const steps = routineSteps([
      item({ id: 'a', position: 0, restSeconds: 10, sets: [set('a1', 0), set('a2', 1)] }),
      item({ id: 'b', position: 1, restSeconds: 10, sets: [set('b1', 0), set('b2', 1)] }),
    ]);
    expect(
      steps.map((s) => `${s.kind}:${s.setId ?? '-'}:${String(s.round)}/${String(s.rounds)}`),
    ).toEqual([
      'exercise:a1:1/2',
      'rest:-:1/2',
      'exercise:b1:1/2',
      'rest:-:1/2',
      'exercise:a2:2/2',
      'rest:-:2/2',
      'exercise:b2:2/2',
    ]);
  });

  it('pauses to switch sides when the exercise asks for it', () => {
    const steps = routineSteps([
      item({ id: 'a', perSide: true, sideRestSeconds: 5, sets: [set('a1', 0), set('a2', 1)] }),
    ]);
    expect(steps.map((s) => `${s.name}:${String(s.seconds)}`)).toEqual([
      'Dehnen:45',
      'Seite wechseln:5',
      'Dehnen:45',
    ]);
  });

  it('keeps the exercise order and falls back to 30 s', () => {
    const steps = routineSteps([
      item({ id: 'b', position: 1, targetSeconds: null, sets: [set('b1', 0)] }),
      item({ id: 'a', position: 0, sets: [set('a1', 0)] }),
    ]);
    expect(steps.map((s) => s.itemId)).toEqual(['a', 'b']);
    expect(steps[1]?.seconds).toBe(30);
  });
});

describe('firstOpenStep', () => {
  it('resumes at the first exercise not done yet', () => {
    const steps = routineSteps([
      item({ id: 'a', restSeconds: 10, sets: [set('a1', 0, true), set('a2', 1)] }),
    ]);
    expect(firstOpenStep(steps, new Set(['a1']))).toBe(2);
    expect(firstOpenStep(steps, new Set(['a1', 'a2']))).toBe(steps.length);
  });
});
