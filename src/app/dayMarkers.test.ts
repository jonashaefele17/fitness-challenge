import { describe, expect, it } from 'vitest';
import { markersByDay } from './dayMarkers';

describe('markersByDay', () => {
  it('ranks a day’s markers: season end, season start, weigh day, check-in', () => {
    const days = markersByDay([
      { onDate: '2026-12-07', kind: 'weigh_day' as const },
      { onDate: '2026-12-07', kind: 'checkin_due' as const },
      { onDate: '2026-12-07', kind: 'season_start' as const },
      { onDate: '2026-12-07', kind: 'weigh_day' as const },
      { onDate: '2026-12-14', kind: 'weigh_day' as const },
    ]);
    expect(days.get('2026-12-07')?.map((m) => m.kind)).toEqual([
      'season_start',
      'weigh_day',
      'checkin_due',
    ]);
    expect(days.get('2026-12-14')?.map((m) => m.kind)).toEqual(['weigh_day']);
    expect(days.get('2026-12-08')).toBeUndefined();
  });
});
