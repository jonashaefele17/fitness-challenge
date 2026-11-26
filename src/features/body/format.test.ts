import { describe, expect, it } from 'vitest';
import {
  dayKey,
  formatKg,
  formatPercentChange,
  formatSignedKg,
  parseKg,
  isoWeekday,
  measuredAtFor,
  offsetText,
  parseOffsetAmount,
  periodRange,
  reminderSummary,
  sameOffset,
  stepKg,
  weighDue,
  weighWindowStart,
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

describe('stepKg', () => {
  it('steps by 0,1 with a German comma', () => {
    expect(stepKg('80,3', 0.1)).toBe('80,4');
    expect(stepKg('80', -0.1)).toBe('79,9');
    expect(stepKg('80.9', 0.1)).toBe('81,0');
  });

  it('leaves what it cannot read', () => {
    expect(stepKg('', 0.1)).toBe('');
    expect(stepKg('80,', 0.1)).toBe('80,');
    expect(stepKg('20', -0.1)).toBe('20');
  });
});

describe('offsets', () => {
  it('reads the amount', () => {
    expect(parseOffsetAmount('0,6')).toBe(0.6);
    expect(parseOffsetAmount('1')).toBe(1);
    expect(parseOffsetAmount('0')).toBe(0);
    expect(parseOffsetAmount('-1')).toBeNull();
    expect(parseOffsetAmount('0,65')).toBeNull();
    expect(parseOffsetAmount('21')).toBeNull();
  });

  it('says it in words', () => {
    expect(offsetText(0.6)).toBe('zeigt 0,6 kg mehr als die Hauptwaage');
    expect(offsetText(-0.35)).toBe('zeigt 0,4 kg weniger als die Hauptwaage');
    expect(offsetText(0.02)).toBe('zeigt dasselbe wie die Hauptwaage');
  });

  it('compares to what is shown', () => {
    expect(sameOffset(0.6, 0.62)).toBe(true);
    expect(sameOffset(0.6, 0.8)).toBe(false);
  });
});

describe('days', () => {
  it('knows the ISO weekday', () => {
    expect(isoWeekday('2026-11-30')).toBe(1);
    expect(isoWeekday('2026-11-29')).toBe(7);
  });

  it('dates a back-filled entry on its day at the current time', () => {
    const now = new Date(2026, 10, 27, 7, 30);
    expect(measuredAtFor('2026-11-27', now)).toBe(now.toISOString());
    expect(measuredAtFor('2026-11-20', now)).toBe(new Date(2026, 10, 20, 7, 30).toISOString());
  });
});

describe('reminderSummary', () => {
  it('lists the days and the time', () => {
    expect(reminderSummary({ weighReminderDays: [1, 4], weighReminderAt: '07:00' })).toBe(
      'Mo, Do · 07:00',
    );
    expect(reminderSummary({ weighReminderDays: [], weighReminderAt: '07:00' })).toBe('Aus');
    expect(reminderSummary(undefined)).toBe('Aus');
  });
});

describe('weighDue', () => {
  // 2026-11-30 is a Monday; weigh day: Monday
  it('is open on the weigh day until there is an entry', () => {
    expect(weighDue('2026-11-30', [1], [], null)).toEqual({ day: '2026-11-30', missed: false });
    expect(weighDue('2026-11-30', [1], ['2026-11-30'], null)).toBeNull();
  });

  it('stays open as missed on the days after, until any entry', () => {
    expect(weighDue('2026-12-02', [1], [], null)).toEqual({ day: '2026-11-30', missed: true });
    expect(weighDue('2026-12-02', [1], ['2026-12-01'], null)).toBeNull();
    // an entry from before the weigh day does not count
    expect(weighDue('2026-12-02', [1], ['2026-11-29'], null)).toEqual({
      day: '2026-11-30',
      missed: true,
    });
  });

  it('is gone when skipped, and back on the next weigh day', () => {
    expect(weighDue('2026-12-02', [1], [], '2026-11-30')).toBeNull();
    expect(weighDue('2026-12-07', [1], [], '2026-11-30')).toEqual({
      day: '2026-12-07',
      missed: false,
    });
  });

  it('takes the latest of several weigh days and nothing without any', () => {
    expect(weighDue('2026-12-04', [1, 4], [], null)).toEqual({ day: '2026-12-03', missed: true });
    expect(weighDue('2026-12-04', [], [], null)).toBeNull();
  });

  it('looks back six days', () => {
    expect(weighWindowStart('2026-12-02')).toBe('2026-11-26');
  });
});
