import { describe, expect, it } from 'vitest';
import { calendarMarkersByDay, markersByDay } from './dayMarkers';

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

describe('calendarMarkersByDay', () => {
  it('shows seasons as flags for everyone (the end highlighted) and body days as a scale', () => {
    const days = calendarMarkersByDay([
      { onDate: '2026-12-07', kind: 'weigh_day' },
      { onDate: '2026-12-07', kind: 'season_end', seasonName: 'Winter' },
      { onDate: '2026-11-30', kind: 'season_start', seasonName: 'Winter' },
    ]);
    expect(days.get('2026-12-07')).toEqual([
      { icon: 'finish', label: 'Saisonende · Winter', scope: 'group', strong: true },
      { icon: 'scale', label: 'Wiegetag', scope: 'personal', strong: false },
    ]);
    expect(days.get('2026-11-30')?.[0]).toMatchObject({ icon: 'flag', strong: false });
  });
});
