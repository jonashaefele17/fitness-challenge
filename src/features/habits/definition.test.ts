import { describe, expect, it } from 'vitest';
import { EMPTY_HABIT } from './defaults';
import { changedFields, habitErrorText } from './definition';

describe('changedFields', () => {
  const sleep = {
    ...EMPTY_HABIT,
    name: 'Schlaf',
    inputType: 'time_pair' as const,
    rule: [{ field: 'duration' as const, op: 'min' as const, value: 420 }],
  };

  it('is empty when nothing changed (also for equal copies of lists)', () => {
    expect(changedFields(sleep, { ...sleep, rule: [...sleep.rule] })).toEqual({});
  });

  it('holds only what changed', () => {
    expect(
      changedFields(sleep, {
        ...sleep,
        name: 'Schlaf ',
        rule: [{ field: 'duration', op: 'min', value: 450 }],
      }),
    ).toEqual({ name: 'Schlaf ', rule: [{ field: 'duration', op: 'min', value: 450 }] });
  });
});

describe('habitErrorText', () => {
  it('explains a habit fixed by a season', () => {
    expect(habitErrorText({ message: 'season_habit_locked' })).toBe(
      'Dieses Habit ist in der laufenden Saison fest.',
    );
    expect(habitErrorText(new Error('other'))).toBeNull();
  });
});
