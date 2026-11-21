import { describe, expect, it } from 'vitest';
import { formatRelativeTime } from './time';

const now = new Date('2026-11-21T12:00:00Z');
const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000).toISOString();

describe('formatRelativeTime', () => {
  it('says "gerade eben" for the last few seconds', () => {
    expect(formatRelativeTime(ago(10), now)).toBe('gerade eben');
  });

  it('uses minutes and hours', () => {
    expect(formatRelativeTime(ago(5 * 60), now)).toBe('vor 5 Minuten');
    expect(formatRelativeTime(ago(3 * 3600), now)).toBe('vor 3 Stunden');
  });

  it('uses "gestern" for one day', () => {
    expect(formatRelativeTime(ago(26 * 3600), now)).toBe('gestern');
  });

  it('falls back to a date after a week', () => {
    expect(formatRelativeTime(ago(10 * 86400), now)).toBe('11. Nov.');
  });
});
