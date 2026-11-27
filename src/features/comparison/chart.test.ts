import { describe, expect, it } from 'vitest';
import { dayPct, percentChartLayout, valueOn } from './chart';

const box = { width: 300, height: 168, left: 44, right: 8, top: 10, bottom: 22 };
const day = (onDate: string, changePct: number) => ({ onDate, changePct });

describe('percentChartLayout', () => {
  const series = [
    { key: 'a', days: [day('2026-11-01', 0), day('2026-11-15', -2), day('2026-11-29', -4)] },
    { key: 'b', days: [day('2026-11-08', 0), day('2026-11-29', 2)] },
  ];

  it('puts all lines on one % axis around all values and zero', () => {
    const layout = percentChartLayout(series, box);
    expect(layout?.minPct).toBe(-4);
    expect(layout?.maxPct).toBe(2);
    // Higher % is higher up; all within the plot.
    const y = layout?.y ?? (() => 0);
    expect(y(2)).toBeLessThan(y(0));
    expect(y(0)).toBeLessThan(y(-4));
    expect(y(2)).toBeGreaterThanOrEqual(box.top);
    expect(y(-4)).toBeLessThanOrEqual(box.height - box.bottom);
  });

  it('spreads the dates of all lines over the width', () => {
    const layout = percentChartLayout(series, box);
    expect(layout?.dates).toEqual(['2026-11-01', '2026-11-08', '2026-11-15', '2026-11-29']);
    expect(layout?.x('2026-11-01')).toBe(box.left);
    expect(layout?.x('2026-11-29')).toBe(box.width - box.right);
    expect(layout?.xs[1]).toBeCloseTo(box.left + (7 / 28) * (box.width - box.left - box.right));
  });

  it('keeps zero in range when every line goes the same way', () => {
    const layout = percentChartLayout([{ key: 'a', days: [day('2026-11-01', 0)] }], box);
    expect(layout?.minPct).toBe(0);
    const down = percentChartLayout(
      [{ key: 'a', days: [day('2026-11-01', 0), day('2026-11-08', -1.5)] }],
      box,
    );
    expect(down?.maxPct).toBe(0);
  });

  it('is at least 2 points high, so a flat line stays flat', () => {
    const layout = percentChartLayout(
      [{ key: 'a', days: [day('2026-11-01', 0), day('2026-11-08', 0.1)] }],
      box,
    );
    const plotH = box.height - box.top - box.bottom;
    const y = layout?.y ?? (() => 0);
    expect(y(0) - y(0.1)).toBeCloseTo((0.1 / 2) * plotH);
  });

  it('one date sits in the middle; nothing without points', () => {
    const one = percentChartLayout([{ key: 'a', days: [day('2026-11-01', 0)] }], box);
    expect(one?.x('2026-11-01')).toBe(box.left + (box.width - box.left - box.right) / 2);
    expect(percentChartLayout([{ key: 'a', days: [] }], box)).toBeNull();
  });
});

describe('valueOn', () => {
  const days = [day('2026-11-01', 0), day('2026-11-08', -1), day('2026-11-15', -2)];

  it('takes the latest point up to the day while the line runs', () => {
    expect(valueOn(days, '2026-11-08')?.changePct).toBe(-1);
    expect(valueOn(days, '2026-11-12')?.changePct).toBe(-1);
  });

  it('nothing before the first or after the last point', () => {
    expect(valueOn(days, '2026-10-31')).toBeNull();
    expect(valueOn(days, '2026-11-16')).toBeNull();
    expect(valueOn([], '2026-11-01')).toBeNull();
  });
});

describe('day values around the lines', () => {
  const box = { width: 300, height: 160, left: 40, right: 8, top: 10, bottom: 20 };
  const series = [
    {
      key: 'a',
      days: [
        { onDate: '2026-11-01', changePct: 0 },
        { onDate: '2026-11-08', changePct: -1 },
      ],
    },
  ];

  it('puts a day value on the axis against the start of the line', () => {
    expect(dayPct(80, 80)).toBe(0);
    expect(dayPct(79.2, 80)).toBeCloseTo(-1);
    expect(dayPct(80.8, 80)).toBeCloseTo(1);
  });

  it('makes room for dots beyond the lines and keeps the labels on the lines', () => {
    const plain = percentChartLayout(series, box);
    const withDots = percentChartLayout(series, box, [2.5, -3]);
    expect(plain && withDots).toBeTruthy();
    if (!plain || !withDots) return;
    // The dots fit inside the plot …
    expect(withDots.y(2.5)).toBeGreaterThanOrEqual(box.top);
    expect(withDots.y(-3)).toBeLessThanOrEqual(box.height - box.bottom);
    // … which without them would be outside …
    expect(plain.y(2.5)).toBeLessThan(box.top);
    // … while min and max still describe the lines.
    expect(withDots.minPct).toBe(-1);
    expect(withDots.maxPct).toBe(0);
  });
});
