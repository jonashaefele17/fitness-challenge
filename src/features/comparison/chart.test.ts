import { describe, expect, it } from 'vitest';
import { cumulativeDays, dayPct, habitWeekLines } from './chart';

describe('dayPct', () => {
  it('puts a day value on the axis against the start of the line', () => {
    expect(dayPct(80, 80)).toBe(0);
    expect(dayPct(79.2, 80)).toBeCloseTo(-1);
    expect(dayPct(80.8, 80)).toBeCloseTo(1);
  });
});

describe('cumulativeDays', () => {
  it('sums the training days up day by day over the whole period', () => {
    expect(cumulativeDays('2026-11-28', '2026-12-02', ['2026-11-29', '2026-12-01'])).toEqual([
      { onDate: '2026-11-28', value: 0 },
      { onDate: '2026-11-29', value: 1 },
      { onDate: '2026-11-30', value: 1 },
      { onDate: '2026-12-01', value: 2 },
      { onDate: '2026-12-02', value: 2 },
    ]);
  });

  it('ignores days outside the period and still draws a flat line without any', () => {
    expect(cumulativeDays('2026-12-01', '2026-12-02', ['2026-11-30', '2026-12-03'])).toEqual([
      { onDate: '2026-12-01', value: 0 },
      { onDate: '2026-12-02', value: 0 },
    ]);
  });

  it('one day for a period of one day, nothing for an empty one', () => {
    expect(cumulativeDays('2026-12-01', '2026-12-01', ['2026-12-01'])).toEqual([
      { onDate: '2026-12-01', value: 1 },
    ]);
    expect(cumulativeDays('2026-12-02', '2026-12-01', [])).toEqual([]);
  });

  it('keeps counting across the change to winter time', () => {
    const points = cumulativeDays('2026-10-24', '2026-10-27', ['2026-10-25', '2026-10-26']);
    expect(points.map((p) => p.onDate)).toEqual([
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
      '2026-10-27',
    ]);
    expect(points.at(-1)?.value).toBe(2);
  });
});

describe('habitWeekLines', () => {
  const people = [
    { userId: 'me', name: 'Du', color: 'c1' },
    { userId: 'a', name: 'Mia', color: 'c2' },
    { userId: 'b', name: 'Tom', color: 'c3' },
  ];

  it('gives a line per person with weeks, in the given order, weeks oldest first', () => {
    const lines = habitWeekLines(
      [
        { userId: 'a', weekStart: '2026-12-07', quotaPct: 50 },
        { userId: 'me', weekStart: '2026-12-07', quotaPct: 100 },
        { userId: 'a', weekStart: '2026-11-30', quotaPct: 79.2 },
      ],
      people,
    );
    expect(lines).toEqual([
      { key: 'me', name: 'Du', color: 'c1', points: [{ onDate: '2026-12-07', value: 100 }] },
      {
        key: 'a',
        name: 'Mia',
        color: 'c2',
        points: [
          { onDate: '2026-11-30', value: 79.2 },
          { onDate: '2026-12-07', value: 50 },
        ],
      },
    ]);
  });

  it('leaves out weeks of people not in the list', () => {
    expect(
      habitWeekLines([{ userId: 'x', weekStart: '2026-11-30', quotaPct: 10 }], people),
    ).toEqual([]);
  });
});
