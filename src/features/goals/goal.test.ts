import { describe, expect, it } from 'vitest';
import {
  applyGoalUpdate,
  draftGoal,
  lowerIsBetter,
  noReference,
  targetLine,
  undoGoalUpdate,
  validateGoalValues,
  validatePeriod,
} from './goal';
import type { CreateGoalInput, GoalMetric } from './types';

const weight: GoalMetric = {
  key: 'body_weight',
  label: 'Körpergewicht',
  description: '',
  kind: 'level',
  reference: null,
  unit: 'kg',
  sort: 20,
};
const trainings: GoalMetric = {
  key: 'trainings_per_week',
  label: 'Trainings pro Woche',
  description: '',
  kind: 'rate',
  reference: null,
  unit: 'per_week',
  sort: 10,
};
const habit = { key: 'habit_rate', kind: 'rate' as const };

describe('validateGoalValues', () => {
  it('accepts a level goal downwards with a minimum on the way', () => {
    expect(
      validateGoalValues(weight, { startValue: 85, minValue: 83, targetValue: 80 }),
    ).toBeNull();
    // holding the start counts as a minimum
    expect(
      validateGoalValues(weight, { startValue: 85, minValue: 85, targetValue: 80 }),
    ).toBeNull();
    expect(
      validateGoalValues(weight, { startValue: 85, minValue: null, targetValue: 90 }),
    ).toBeNull();
  });

  it('rejects what the database rejects for levels', () => {
    expect(validateGoalValues(weight, { startValue: 85, minValue: null, targetValue: null })).toBe(
      'Bitte gib einen Zielwert ein.',
    );
    expect(validateGoalValues(weight, { startValue: null, minValue: null, targetValue: 80 })).toBe(
      'Bitte gib einen Startwert ein.',
    );
    expect(validateGoalValues(weight, { startValue: 85, minValue: null, targetValue: 85 })).toBe(
      'Ziel und Startwert sind gleich.',
    );
    expect(validateGoalValues(weight, { startValue: 85, minValue: 79, targetValue: 80 })).toBe(
      'Das Mindestziel liegt zwischen Startwert und Ziel.',
    );
    expect(validateGoalValues(weight, { startValue: 85, minValue: 80, targetValue: 80 })).toBe(
      'Das Mindestziel liegt zwischen Startwert und Ziel.',
    );
    expect(validateGoalValues(weight, { startValue: 85, minValue: 86, targetValue: 80 })).toBe(
      'Das Mindestziel liegt zwischen Startwert und Ziel.',
    );
  });

  it('checks rates', () => {
    expect(
      validateGoalValues(trainings, { startValue: null, minValue: 3, targetValue: 4 }),
    ).toBeNull();
    expect(validateGoalValues(trainings, { startValue: null, minValue: 4, targetValue: 4 })).toBe(
      'Das Mindestziel muss kleiner als das Ziel sein.',
    );
    expect(
      validateGoalValues(trainings, { startValue: null, minValue: null, targetValue: 0 }),
    ).toBe('Das Ziel muss größer als 0 sein.');
    expect(
      validateGoalValues(trainings, { startValue: null, minValue: null, targetValue: 8 }),
    ).toBe('Höchstens 7 – es zählt ein Training pro Tag.');
    expect(validateGoalValues(habit, { startValue: 70, minValue: 80, targetValue: 90 })).toBeNull();
    expect(validateGoalValues(habit, { startValue: null, minValue: null, targetValue: 101 })).toBe(
      'Höchstens 100 %.',
    );
  });
});

describe('period and direction', () => {
  it('needs the end after the start', () => {
    expect(validatePeriod('2026-12-01', '2026-12-31')).toBeNull();
    expect(validatePeriod('2026-12-01', '2026-12-01')).toBe('Das Ende muss nach dem Start liegen.');
  });

  it('knows lower is better', () => {
    expect(lowerIsBetter({ startValue: 85, targetValue: 80 })).toBe(true);
    expect(lowerIsBetter({ startValue: 97.5, targetValue: 110 })).toBe(false);
    expect(lowerIsBetter({ startValue: null, targetValue: 80 })).toBe(false);
  });
});

const input: CreateGoalInput = {
  id: 'g1',
  metric: 'body_weight',
  reference: noReference,
  reps: null,
  startsOn: '2026-12-01',
  endsOn: '2026-12-31',
  startValue: 85,
  minValue: 83,
  targetValue: 80,
  visibility: 'shared',
};

describe('draftGoal', () => {
  const draft = draftGoal(input, {
    metric: weight,
    unit: 'kg',
    referenceLabel: null,
    referenceDetail: null,
    userId: 'u1',
    today: '2026-12-16',
  });

  it('shows the definition at once, figures still unknown', () => {
    expect(draft).toMatchObject({
      id: 'g1',
      userId: 'u1',
      metricLabel: 'Körpergewicht',
      metricKind: 'level',
      unit: 'kg',
      startValue: 85,
      minValue: 83,
      targetValue: 80,
      phase: 'running',
      evaluatedOn: '2026-12-16',
      currentValue: null,
      status: null,
      onTrack: null,
      archivedAt: null,
    });
  });

  it('knows the phase', () => {
    const context = {
      metric: weight,
      unit: 'kg' as const,
      referenceLabel: null,
      referenceDetail: null,
      userId: 'u1',
    };
    expect(draftGoal(input, { ...context, today: '2026-11-20' }).phase).toBe('upcoming');
    const ended = draftGoal(input, { ...context, today: '2027-01-05' });
    expect(ended.phase).toBe('ended');
    expect(ended.evaluatedOn).toBe('2026-12-31');
  });

  it('draws the line from start to target', () => {
    expect(targetLine(draft)).toEqual([
      { onDate: '2026-12-01', value: 85 },
      { onDate: '2026-12-31', value: 80 },
    ]);
    expect(targetLine({ ...draft, startValue: null })).toBeNull();
    expect(targetLine({ ...draft, metricKind: 'rate' })).toBeNull();
  });

  it('applies an update and builds its undo', () => {
    const update = {
      goalId: 'g1',
      startsOn: '2026-12-01',
      endsOn: '2027-01-31',
      startValue: 85,
      minValue: null,
      targetValue: 78,
      visibility: 'private' as const,
    };
    const updated = applyGoalUpdate(draft, update);
    expect(updated).toMatchObject({ endsOn: '2027-01-31', minValue: null, targetValue: 78 });
    expect(undoGoalUpdate(draft, update, '2026-12-16')).toEqual({
      goalId: 'g1',
      startsOn: '2026-12-01',
      endsOn: '2026-12-31',
      startValue: 85,
      minValue: 83,
      targetValue: 80,
      visibility: 'shared',
      validFrom: '2026-12-16',
    });
  });
});
