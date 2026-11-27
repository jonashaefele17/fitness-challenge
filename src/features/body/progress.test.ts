import { describe, expect, it } from 'vitest';
import { weightWeek, weightWeekRange } from './progress';
import type { WeightProgressDay } from './types';

const day = (onDate: string, changePct: number, trendKg: number | null = null) =>
  ({ onDate, changePct, trendKg }) satisfies WeightProgressDay;

describe('weightWeekRange', () => {
  it('covers the 4 weeks and the week before them', () => {
    expect(weightWeekRange('2026-12-07')).toEqual({ from: '2026-11-09', to: '2026-12-13' });
  });
});

describe('weightWeek', () => {
  // Weekly on Mondays, trend 82 → 81.6 → 81.2 → 80.8 → 80.4 (only %, against 9.11.)
  const weekly = [
    day('2026-11-09', 0),
    day('2026-11-16', -0.49),
    day('2026-11-23', -0.98),
    day('2026-11-30', -1.46),
    day('2026-12-07', -1.95),
  ];

  it('compares with the week before and the week before the 4 weeks', () => {
    expect(weightWeek(weekly, '2026-12-07')).toEqual({
      weekStart: '2026-12-07',
      weekEnd: '2026-12-13',
      weekPct: -0.5,
      weekKg: null,
      fourWeeksPct: -1.95,
      fourWeeksKg: null,
    });
  });

  it('uses the kg trend when shared in kg', () => {
    const kg = [day('2026-11-30', 0, 81.0), day('2026-12-09', -0.62, 80.5)];
    const week = weightWeek(kg, '2026-12-07');
    expect(week?.weekKg).toBe(-0.5);
    expect(week?.weekPct).toBe(-0.62);
    expect(week?.fourWeeksKg).toBe(-0.5);
  });

  it('takes the latest day of the week, in any order', () => {
    const days = [day('2026-12-10', -1.0), day('2026-12-08', -0.5), day('2026-12-01', 0)];
    expect(weightWeek(days, '2026-12-07')?.weekPct).toBe(-1);
  });

  it('without the week before: the change within the week', () => {
    const days = [day('2026-12-07', 0), day('2026-12-11', -0.4)];
    const week = weightWeek(days, '2026-12-07');
    expect(week?.weekPct).toBe(-0.4);
    expect(week?.fourWeeksPct).toBe(-0.4);
  });

  it('a single day without anything before: no change', () => {
    const week = weightWeek([day('2026-12-09', 0)], '2026-12-07');
    expect(week?.weekPct).toBeNull();
    expect(week?.fourWeeksPct).toBeNull();
  });

  it('nothing in the week (or nothing shared): null', () => {
    expect(weightWeek([day('2026-12-01', 0)], '2026-12-07')).toBeNull();
    expect(weightWeek([], '2026-12-07')).toBeNull();
  });

  it('does not reach further back than the week before', () => {
    const days = [day('2026-11-20', 0), day('2026-12-09', -2)];
    // 20.11. is before 30.11. (the week before 7.12.): the week has nothing to compare with
    expect(weightWeek(days, '2026-12-07')?.weekPct).toBeNull();
    // within the 4 weeks (from 16.11.) it is the first day to compare with
    expect(weightWeek(days, '2026-12-07')?.fourWeeksPct).toBe(-2);
  });
});
