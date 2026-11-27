import { describe, expect, it } from 'vitest';
import { dotRadius, nearestIndex, timeChartLayout, weightChartLayout } from './chart';
import type { WeightDay } from './types';

const box = { width: 320, height: 168, left: 40, right: 10, top: 10, bottom: 20 };
const day = (onDate: string, weightKg: number, trendKg = weightKg): WeightDay => ({
  onDate,
  weightKg,
  trendKg,
  entries: 1,
});

describe('weightChartLayout', () => {
  it('has nothing to lay out without days', () => {
    expect(weightChartLayout([], box)).toBeNull();
  });

  it('puts a single day in the middle', () => {
    const layout = weightChartLayout([day('2026-11-27', 81.4)], box);
    expect(layout?.xs).toEqual([40 + 270 / 2]);
    // Centred vertically too: a 1 kg axis around the value.
    expect(layout?.y(81.4)).toBeCloseTo(10 + 138 / 2);
  });

  it('spreads days by date, so gaps stay visible', () => {
    const layout = weightChartLayout(
      [day('2026-11-01', 82), day('2026-11-02', 81.8), day('2026-11-11', 81)],
      box,
    );
    expect(layout?.xs[0]).toBe(40);
    expect(layout?.xs[1]).toBeCloseTo(40 + 27);
    expect(layout?.xs[2]).toBe(310);
  });

  it('keeps at least 1 kg of axis for flat values', () => {
    const layout = weightChartLayout([day('2026-11-01', 80), day('2026-11-02', 80.2)], box);
    const top = layout?.y(80.6) ?? 0;
    const bottom = layout?.y(79.6) ?? 0;
    expect(top).toBeCloseTo(10);
    expect(bottom).toBeCloseTo(148);
  });

  it('takes the trend into the range and reports min and max', () => {
    const layout = weightChartLayout([day('2026-11-01', 80, 83), day('2026-11-05', 82, 81)], box);
    expect(layout?.minKg).toBe(80);
    expect(layout?.maxKg).toBe(83);
    expect(layout?.y(83)).toBeGreaterThan(10);
    expect(layout?.y(80)).toBeLessThan(148);
  });
});

describe('nearestIndex', () => {
  it('finds the closest point', () => {
    expect(nearestIndex([0, 10, 20], 14)).toBe(1);
    expect(nearestIndex([0, 10, 20], 99)).toBe(2);
    expect(nearestIndex([], 5)).toBe(-1);
  });
});

describe('dotRadius', () => {
  it('gets smaller with many days', () => {
    expect(dotRadius(2)).toBeGreaterThan(dotRadius(300));
  });
});

describe('timeChartLayout', () => {
  it('lays out any series by date with the given minimum span', () => {
    expect(timeChartLayout([], [], box, 2)).toBeNull();
    const one = timeChartLayout(['2026-11-01'], [84.5], box, 2);
    expect(one?.xs).toEqual([40 + 270 / 2]);
    // A 2 cm axis around a single value: 1 cm above is the top of the plot.
    expect(one?.y(85.5)).toBeCloseTo(10);
    const two = timeChartLayout(['2026-10-01', '2026-11-01'], [86, 84], box, 2);
    expect(two?.xs).toEqual([40, 310]);
    expect(two && two.y(86) < two.y(84)).toBe(true);
  });
});
