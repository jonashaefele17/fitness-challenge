import { describe, expect, it } from 'vitest';
import { lineChartLayout, nearestIndex, valueOn } from './chartLayout';

const box = { width: 300, height: 168, left: 44, right: 8, top: 10, bottom: 22 };
const day = (onDate: string, value: number) => ({ onDate, value });
const plotH = box.height - box.top - box.bottom;

describe('lineChartLayout, % axis', () => {
  const series = [
    { points: [day('2026-11-01', 0), day('2026-11-15', -2), day('2026-11-29', -4)] },
    { points: [day('2026-11-08', 0), day('2026-11-29', 2)] },
  ];

  it('puts all lines on one axis around all values and zero', () => {
    const layout = lineChartLayout(series, box, 'percent');
    expect(layout?.min).toBe(-4);
    expect(layout?.max).toBe(2);
    // Higher is higher up; all within the plot.
    const y = layout?.y ?? (() => 0);
    expect(y(2)).toBeLessThan(y(0));
    expect(y(0)).toBeLessThan(y(-4));
    expect(y(2)).toBeGreaterThanOrEqual(box.top);
    expect(y(-4)).toBeLessThanOrEqual(box.height - box.bottom);
  });

  it('spreads the dates of all lines over the width', () => {
    const layout = lineChartLayout(series, box, 'percent');
    expect(layout?.dates).toEqual(['2026-11-01', '2026-11-08', '2026-11-15', '2026-11-29']);
    expect(layout?.x('2026-11-01')).toBe(box.left);
    expect(layout?.x('2026-11-29')).toBe(box.width - box.right);
    expect(layout?.xs[1]).toBeCloseTo(box.left + (7 / 28) * (box.width - box.left - box.right));
  });

  it('keeps zero in range when every line goes the same way', () => {
    const layout = lineChartLayout([{ points: [day('2026-11-01', 0)] }], box, 'percent');
    expect(layout?.min).toBe(0);
    const down = lineChartLayout(
      [{ points: [day('2026-11-01', 0), day('2026-11-08', -1.5)] }],
      box,
      'percent',
    );
    expect(down?.max).toBe(0);
  });

  it('is at least 2 points high, so a flat line stays flat', () => {
    const layout = lineChartLayout(
      [{ points: [day('2026-11-01', 0), day('2026-11-08', 0.1)] }],
      box,
      'percent',
    );
    const y = layout?.y ?? (() => 0);
    expect(y(0) - y(0.1)).toBeCloseTo((0.1 / 2) * plotH);
  });

  it('one date sits in the middle; nothing without points', () => {
    const one = lineChartLayout([{ points: [day('2026-11-01', 0)] }], box, 'percent');
    expect(one?.x('2026-11-01')).toBe(box.left + (box.width - box.left - box.right) / 2);
    expect(lineChartLayout([{ points: [] }], box, 'percent')).toBeNull();
  });

  it('makes room for further values and keeps min and max on the lines', () => {
    const small = { width: 300, height: 160, left: 40, right: 8, top: 10, bottom: 20 };
    const lines = [{ points: [day('2026-11-01', 0), day('2026-11-08', -1)] }];
    const plain = lineChartLayout(lines, small, 'percent');
    const withDots = lineChartLayout(lines, small, 'percent', [2.5, -3]);
    expect(plain && withDots).toBeTruthy();
    if (!plain || !withDots) return;
    // The dots fit inside the plot …
    expect(withDots.y(2.5)).toBeGreaterThanOrEqual(small.top);
    expect(withDots.y(-3)).toBeLessThanOrEqual(small.height - small.bottom);
    // … which without them would be outside …
    expect(plain.y(2.5)).toBeLessThan(small.top);
    // … while min and max still describe the lines.
    expect(withDots.min).toBe(-1);
    expect(withDots.max).toBe(0);
  });
});

describe('lineChartLayout, count axis', () => {
  it('starts at zero at the bottom and fits the highest count with a little air', () => {
    const layout = lineChartLayout(
      [{ points: [day('2026-11-01', 0), day('2026-11-02', 10)] }],
      box,
      'count',
    );
    const y = layout?.y ?? (() => 0);
    expect(y(0)).toBe(box.height - box.bottom);
    expect(y(10)).toBeGreaterThan(box.top);
    expect(y(10)).toBeCloseTo(box.top + (1 - 10 / 11.2) * plotH);
    expect(layout?.max).toBe(10);
  });

  it('reaches at least 4, so a single day does not fill the height', () => {
    const layout = lineChartLayout(
      [{ points: [day('2026-11-01', 0), day('2026-11-02', 1)] }],
      box,
      'count',
    );
    const y = layout?.y ?? (() => 0);
    expect(y(4)).toBeCloseTo(box.top);
    expect(y(0) - y(1)).toBeCloseTo(plotH / 4);
  });
});

describe('lineChartLayout, progress axis', () => {
  it('is fixed to 0 … 100 %, whatever the lines reach', () => {
    const layout = lineChartLayout(
      [{ points: [day('2026-11-01', 0), day('2026-11-08', 12)] }],
      box,
      'progress',
    );
    const y = layout?.y ?? (() => 0);
    expect(y(0)).toBe(box.height - box.bottom);
    expect(y(100)).toBe(box.top);
    expect(y(50)).toBeCloseTo(box.top + plotH / 2);
    expect(layout?.min).toBe(0);
    expect(layout?.max).toBe(100);
  });
});

describe('valueOn', () => {
  const days = [day('2026-11-01', 0), day('2026-11-08', -1), day('2026-11-15', -2)];

  it('takes the latest point up to the day while the line runs', () => {
    expect(valueOn(days, '2026-11-08')?.value).toBe(-1);
    expect(valueOn(days, '2026-11-12')?.value).toBe(-1);
  });

  it('nothing before the first or after the last point', () => {
    expect(valueOn(days, '2026-10-31')).toBeNull();
    expect(valueOn(days, '2026-11-16')).toBeNull();
    expect(valueOn([], '2026-11-01')).toBeNull();
  });
});

describe('nearestIndex', () => {
  it('finds the closest x', () => {
    expect(nearestIndex([0, 10, 20], 14)).toBe(1);
    expect(nearestIndex([0, 10, 20], 99)).toBe(2);
    expect(nearestIndex([], 5)).toBe(-1);
  });
});
