import { describe, expect, it } from 'vitest';
import { dayLabel } from './dayLabel';

describe('dayLabel', () => {
  const now = new Date(2026, 10, 21, 9, 30);

  it('names today and yesterday', () => {
    expect(dayLabel('2026-11-21', now)).toBe('Heute');
    expect(dayLabel('2026-11-20', now)).toBe('Gestern');
  });

  it('shows weekday and date further back', () => {
    expect(dayLabel('2026-11-16', now)).toBe('Mo., 16. Nov.');
  });
});
