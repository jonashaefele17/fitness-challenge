import { describe, expect, it } from 'vitest';
import {
  dayKey,
  formatKg,
  formatPercentChange,
  formatSignedKg,
  parseKg,
  periodRange,
} from './format';

describe('formatting weights', () => {
  it('uses one decimal and a German comma', () => {
    expect(formatKg(80.25)).toBe('80,3');
    expect(formatKg(80)).toBe('80,0');
    expect(formatKg(null)).toBe('–');
  });

  it('signs changes', () => {
    expect(formatSignedKg(-0.74)).toBe('−0,7');
    expect(formatSignedKg(0.3)).toBe('+0,3');
    expect(formatSignedKg(0.04)).toBe('±0,0');
    expect(formatSignedKg(-0.04)).toBe('±0,0');
    expect(formatSignedKg(null)).toBe('–');
  });

  it('signs percent changes', () => {
    expect(formatPercentChange(-0.91)).toBe('−0,9 %');
    expect(formatPercentChange(1.25)).toBe('+1,3 %');
    expect(formatPercentChange(0)).toBe('±0,0 %');
    expect(formatPercentChange(null)).toBe('–');
  });
});

describe('parseKg', () => {
  it('reads comma and point', () => {
    expect(parseKg('80,3')).toBe(80.3);
    expect(parseKg(' 80.3 ')).toBe(80.3);
    expect(parseKg('80')).toBe(80);
  });

  it('rejects what the database would', () => {
    expect(parseKg('80,35')).toBeNull();
    expect(parseKg('12')).toBeNull();
    expect(parseKg('401')).toBeNull();
    expect(parseKg('abc')).toBeNull();
    expect(parseKg('')).toBeNull();
  });
});

describe('periodRange', () => {
  it('ends today and starts so that the period has its length', () => {
    expect(periodRange('4w', '2026-12-28')).toEqual({ from: '2026-12-01', to: '2026-12-28' });
    expect(periodRange('3m', '2026-12-28')).toEqual({ from: '2026-09-29', to: '2026-12-28' });
    expect(periodRange('1y', '2026-12-28')).toEqual({ from: '2025-12-29', to: '2026-12-28' });
  });

  it('has no start for "Alles"', () => {
    expect(periodRange('all', '2026-12-28')).toEqual({ from: null, to: '2026-12-28' });
  });

  it('keys local days', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
});
