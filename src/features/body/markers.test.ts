import { describe, expect, it } from 'vitest';
import { bodyMarkerText, daysFromTo, upcomingBodyMarkers } from './markers';

describe('daysFromTo', () => {
  it('counts whole days, across months and the clock change', () => {
    expect(daysFromTo('2026-12-01', '2026-12-01')).toBe(0);
    expect(daysFromTo('2026-11-30', '2026-12-02')).toBe(2);
    expect(daysFromTo('2027-03-27', '2027-03-29')).toBe(2);
    expect(daysFromTo('2026-12-05', '2026-12-01')).toBe(-4);
  });
});

describe('bodyMarkerText', () => {
  it('reads as an upcoming day', () => {
    expect(bodyMarkerText({ onDate: '2026-12-01', kind: 'weigh_day' }, '2026-12-01')).toBe(
      'Heute Wiegetag',
    );
    expect(bodyMarkerText({ onDate: '2026-12-02', kind: 'weigh_day' }, '2026-12-01')).toBe(
      'Morgen Wiegetag',
    );
    expect(bodyMarkerText({ onDate: '2026-12-04', kind: 'checkin_due' }, '2026-12-01')).toBe(
      'Zwischenstand in 3 Tagen',
    );
    expect(bodyMarkerText({ onDate: '2026-11-30', kind: 'checkin_due' }, '2026-12-01')).toBe(
      'Zwischenstand',
    );
  });
});

describe('upcomingBodyMarkers', () => {
  it('keeps today up to the window, by day, weigh day first', () => {
    const markers = [
      { onDate: '2026-12-08', kind: 'weigh_day' as const },
      { onDate: '2026-12-02', kind: 'checkin_due' as const },
      { onDate: '2026-12-02', kind: 'weigh_day' as const },
      { onDate: '2026-11-30', kind: 'weigh_day' as const },
      { onDate: '2026-12-01', kind: 'checkin_due' as const },
    ];
    expect(upcomingBodyMarkers(markers, '2026-12-01', 1)).toEqual([
      { onDate: '2026-12-01', kind: 'checkin_due' },
      { onDate: '2026-12-02', kind: 'weigh_day' },
      { onDate: '2026-12-02', kind: 'checkin_due' },
    ]);
  });
});
