import { describe, expect, it } from 'vitest';
import {
  addMonths,
  dayKey,
  isoWeek,
  monthGrid,
  startOfWeek,
  visibleRange,
  weekDays,
} from './calendar';

describe('calendar helpers', () => {
  it('formats local day keys', () => {
    expect(dayKey(new Date(2026, 10, 5))).toBe('2026-11-05');
  });

  it('starts weeks on Monday', () => {
    // Sunday 22 Nov 2026 belongs to the week starting Monday 16 Nov.
    expect(dayKey(startOfWeek(new Date(2026, 10, 22)))).toBe('2026-11-16');
    expect(weekDays(new Date(2026, 10, 18)).map(dayKey)).toEqual([
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
      '2026-11-22',
    ]);
  });

  it('covers the month with full weeks', () => {
    const weeks = monthGrid(new Date(2026, 10, 21));
    // November 2026: Sunday the 1st → first row starts Monday 26 Oct, last row ends Sunday 6 Dec.
    expect(dayKey(weeks[0]?.[0] ?? new Date(0))).toBe('2026-10-26');
    expect(dayKey(weeks.at(-1)?.[6] ?? new Date(0))).toBe('2026-12-06');
    expect(weeks).toHaveLength(6);
  });

  it('has an end-exclusive visible range', () => {
    const { from, to } = visibleRange('week', new Date(2026, 10, 21));
    expect(dayKey(from)).toBe('2026-11-16');
    expect(dayKey(to)).toBe('2026-11-23');
  });

  it('clamps month arithmetic to the last day', () => {
    expect(dayKey(addMonths(new Date(2026, 0, 31), 1))).toBe('2026-02-28');
  });

  it('computes ISO week numbers', () => {
    expect(isoWeek(new Date(2026, 10, 21))).toBe(47);
    expect(isoWeek(new Date(2027, 0, 1))).toBe(53);
  });
});
