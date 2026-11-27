import { describe, expect, it } from 'vitest';
import { barChartScale, levelChartScale, mondayOf, nearestIndex, rateWeeks } from './chart';
import type { GoalHistoryPoint } from './types';

const box = { width: 340, height: 168, left: 40, right: 0, top: 10, bottom: 18 };
const point = (onDate: string, value: number | null): GoalHistoryPoint => ({
  onDate,
  value,
  minValue: null,
  targetValue: null,
  expectedValue: null,
  progressPct: null,
  state: null,
});

describe('levelChartScale', () => {
  const goal = {
    startsOn: '2026-11-01',
    endsOn: '2026-11-11',
    startValue: 86,
    minValue: 82,
    targetValue: 78,
    unit: 'kg' as const,
  };

  it('spans the whole period on the x axis', () => {
    const scale = levelChartScale(goal, [], box);
    expect(scale?.x('2026-11-01')).toBe(40);
    expect(scale?.x('2026-11-06')).toBe(190);
    expect(scale?.x('2026-11-11')).toBe(340);
  });

  it('keeps start, minimum and target on the y axis', () => {
    const scale = levelChartScale(goal, [point('2026-11-03', 85)], box);
    expect(scale?.lo).toBeLessThan(78);
    expect(scale?.hi).toBeGreaterThan(86);
  });

  it('has nothing to scale without any value', () => {
    expect(
      levelChartScale({ ...goal, startValue: null, minValue: null, targetValue: null }, [], box),
    ).toBeNull();
  });
});

describe('rateWeeks', () => {
  it('lists every week of the period with its point', () => {
    const weeks = rateWeeks({ startsOn: '2026-11-04', endsOn: '2026-11-22' }, [
      point('2026-11-09', 3),
    ]);
    expect(weeks.map((w) => w.weekStart)).toEqual(['2026-11-02', '2026-11-09', '2026-11-16']);
    expect(weeks[1]?.point?.value).toBe(3);
    expect(weeks[0]?.point).toBeNull();
  });

  it('finds the Monday of a week', () => {
    expect(mondayOf('2026-11-29')).toBe('2026-11-23');
    expect(mondayOf('2026-11-23')).toBe('2026-11-23');
  });
});

describe('barChartScale', () => {
  it('reaches a bit above the target and splits the width into slots', () => {
    const weeks = rateWeeks({ startsOn: '2026-11-02', endsOn: '2026-11-15' }, [
      point('2026-11-02', 2),
    ]);
    const scale = barChartScale(weeks, 4, box);
    expect(scale.hi).toBeCloseTo(4.4);
    expect(scale.bars).toHaveLength(2);
    expect(scale.y(0)).toBe(150);
  });
});

describe('nearestIndex', () => {
  it('picks the closest x', () => {
    expect(nearestIndex([10, 50, 90], 60)).toBe(1);
    expect(nearestIndex([], 60)).toBe(-1);
  });
});
