import { describe, expect, it } from 'vitest';
import type { Goal } from './types';
import {
  addDays,
  createSteps,
  fitMinGoal,
  formatGoalPeriod,
  matchingPeriodChoice,
  minGoalRange,
  minMarkerPct,
  parseGoalNumber,
  periodEnd,
  periodStateText,
  roundGoalValue,
  snapToStep,
  splitGoals,
  targetWheelStart,
  wheelStep,
} from './view';

describe('periodEnd', () => {
  it('counts whole weeks including the first day', () => {
    expect(periodEnd('2026-11-30', '4w')).toBe('2026-12-27');
    expect(periodEnd('2026-11-27', '12w')).toBe('2027-02-18');
  });

  it('ends six months later the day before', () => {
    expect(periodEnd('2026-12-01', '6m')).toBe('2027-05-31');
  });

  it('clamps to the end of a shorter month', () => {
    expect(periodEnd('2026-08-31', '6m')).toBe('2027-02-27');
  });

  it('finds the quick choice a period matches', () => {
    expect(matchingPeriodChoice('2026-11-30', '2026-12-27')).toBe('4w');
    expect(matchingPeriodChoice('2026-11-30', '2026-12-28')).toBeNull();
  });
});

describe('addDays', () => {
  it('crosses months and years', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('minMarkerPct', () => {
  it('places the minimum between start and target for levels', () => {
    expect(
      minMarkerPct({ metricKind: 'level', startValue: 86, minValue: 82, targetValue: 78 }),
    ).toBe(50);
  });

  it('is a share of the target for rates', () => {
    expect(
      minMarkerPct({ metricKind: 'rate', startValue: null, minValue: 3, targetValue: 4 }),
    ).toBe(75);
  });

  it('is null without a minimum', () => {
    expect(
      minMarkerPct({ metricKind: 'rate', startValue: null, minValue: null, targetValue: 4 }),
    ).toBeNull();
  });
});

describe('createSteps', () => {
  it('asks for a start value only for levels', () => {
    expect(createSteps({ kind: 'rate', reference: null }, null)).toEqual([
      'metric',
      'target',
      'min',
      'period',
      'visibility',
      'summary',
    ]);
    expect(createSteps({ kind: 'level', reference: null }, null)).toContain('start');
  });

  it('asks for the reference and, for weight exercises, the reps', () => {
    expect(createSteps({ kind: 'level', reference: 'exercise' }, { needsReps: true })).toEqual([
      'metric',
      'reference',
      'reps',
      'start',
      'target',
      'min',
      'period',
      'visibility',
      'summary',
    ]);
  });
});

describe('wheel helpers', () => {
  it('uses steps that fit the unit', () => {
    expect(wheelStep('body_weight', 'kg', 'start')).toBe(0.1);
    expect(wheelStep('body_weight', 'kg', 'goal')).toBe(0.5);
    expect(wheelStep('exercise_best', 'kg', 'goal')).toBe(2.5);
    expect(wheelStep('trainings_per_week', 'per_week', 'goal')).toBe(1);
  });

  it('snaps a value onto the grid', () => {
    expect(snapToStep(84.3, 0.5)).toBe(84.5);
    expect(snapToStep(41.2, 2.5)).toBe(40);
  });

  it('starts the target wheel near something sensible', () => {
    expect(targetWheelStart({ key: 'body_weight', kind: 'level' }, 'kg', 84.3)).toBe(84.5);
    expect(targetWheelStart({ key: 'trainings_per_week', kind: 'rate' }, 'per_week', 2.5)).toBe(3);
    expect(targetWheelStart({ key: 'habit_rate', kind: 'rate' }, 'percent', 97)).toBe(100);
  });

  it('reads German and English decimals', () => {
    expect(parseGoalNumber('82,5')).toBe(82.5);
    expect(parseGoalNumber('82.5')).toBe(82.5);
    expect(parseGoalNumber('')).toBeNull();
    expect(parseGoalNumber('-1')).toBeNull();
  });

  it('rounds computed values to their precision', () => {
    expect(roundGoalValue(81.37, 'kg')).toBe(81.4);
    expect(roundGoalValue(78.6, 'percent')).toBe(79);
  });
});

describe('texts', () => {
  it('writes the period', () => {
    expect(formatGoalPeriod('2026-11-27', '2026-12-24', '2026-11-27')).toBe('27. Nov. – 24. Dez.');
    expect(formatGoalPeriod('2026-12-01', '2027-05-31', '2026-11-27')).toBe(
      '1. Dez. 2026 – 31. Mai 2027',
    );
  });

  it('says how long is left', () => {
    const goal = { phase: 'running' as const, startsOn: '2026-11-01', endsOn: '2026-11-30' };
    expect(periodStateText(goal, '2026-11-27')).toBe('noch 3 Tage');
    expect(periodStateText(goal, '2026-11-29')).toBe('noch 1 Tag');
    expect(
      periodStateText({ ...goal, phase: 'upcoming', startsOn: '2026-11-28' }, '2026-11-27'),
    ).toBe('startet morgen');
  });
});

describe('splitGoals', () => {
  it('puts ended and archived goals apart', () => {
    const base = { archivedAt: null, phase: 'running' } as Goal;
    const { active, ended } = splitGoals([
      { ...base, id: 'a' },
      { ...base, id: 'b', phase: 'ended' },
      { ...base, id: 'c', archivedAt: '2026-11-20T10:00:00Z' },
      { ...base, id: 'd', phase: 'upcoming' },
    ]);
    expect(active.map((g) => g.id)).toEqual(['a', 'd']);
    expect(ended.map((g) => g.id)).toEqual(['b', 'c']);
  });
});

describe('minGoalRange', () => {
  it('keeps a rate minimum below the target', () => {
    expect(minGoalRange('rate', null, 4, 1)).toEqual({ min: 1, max: 3, initial: 3 });
    expect(minGoalRange('rate', null, 1, 1)).toBeNull();
    expect(minGoalRange('rate', null, null, 1)).toBeNull();
  });

  it('puts a level minimum between start and target, whichever way the goal goes', () => {
    // Losing weight: the minimum lies above the target.
    expect(minGoalRange('level', 85, 80, 0.5)).toEqual({ min: 80.5, max: 85, initial: 82.5 });
    // Gaining strength: below it.
    expect(minGoalRange('level', 100, 120, 2.5)).toEqual({ min: 100, max: 117.5, initial: 110 });
    expect(minGoalRange('level', 84.3, 84.5, 0.5)).toBeNull();
    expect(minGoalRange('level', null, 80, 0.5)).toBeNull();
  });

  it('pulls a minimum back into its range after the target moved', () => {
    expect(fitMinGoal(4, minGoalRange('rate', null, 3, 1))).toBe(2);
    expect(fitMinGoal(2, minGoalRange('rate', null, 1, 1))).toBeNull();
    expect(fitMinGoal(null, minGoalRange('rate', null, 4, 1))).toBeNull();
  });
});
