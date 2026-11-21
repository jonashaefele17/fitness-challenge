import { describe, expect, it } from 'vitest';
import { dayKey, isoWeek, startOfWeek, weekDays } from './calendar';

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

  it('computes ISO week numbers', () => {
    expect(isoWeek(new Date(2026, 10, 21))).toBe(47);
    expect(isoWeek(new Date(2027, 0, 1))).toBe(53);
  });
});
