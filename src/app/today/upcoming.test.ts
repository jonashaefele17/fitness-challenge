import { describe, expect, it } from 'vitest';
import type { Season } from '@/features/seasons';
import { setupCardText, upcomingLines } from './upcoming';

const today = '2026-11-27';

describe('upcomingLines', () => {
  it('says what is coming, nearest first, one line per kind', () => {
    const lines = upcomingLines(
      [
        { onDate: '2026-12-02', kind: 'season_end', seasonName: 'Winter' },
        { onDate: '2026-11-28', kind: 'weigh_day' },
        { onDate: '2026-11-30', kind: 'weigh_day' },
        { onDate: '2026-11-29', kind: 'checkin_due' },
      ],
      today,
      { setupCardShown: false },
    );
    expect(lines.map((l) => l.text)).toEqual([
      'Morgen Wiegetag',
      'Zwischenstand in 2 Tagen',
      'Noch 5 Tage bis Saisonende',
    ]);
  });

  it('leaves out today’s weigh day and check-in (their cards show) but not today’s season end', () => {
    const lines = upcomingLines(
      [
        { onDate: today, kind: 'weigh_day' },
        { onDate: today, kind: 'checkin_due' },
        { onDate: today, kind: 'season_end', seasonName: 'Winter' },
      ],
      today,
      { setupCardShown: false },
    );
    expect(lines.map((l) => l.text)).toEqual(['Heute Saisonende']);
  });

  it('leaves out what is too far ahead and the start while the setup card says it', () => {
    const markers = [
      { onDate: '2026-11-30', kind: 'season_start' as const, seasonName: 'Winter' },
      { onDate: '2026-11-30', kind: 'weigh_day' as const },
      { onDate: '2026-12-20', kind: 'season_end' as const, seasonName: 'Winter' },
    ];
    expect(upcomingLines(markers, today, { setupCardShown: true })).toEqual([]);
    expect(upcomingLines(markers, today, { setupCardShown: false }).map((l) => l.text)).toEqual([
      'Noch 3 Tage bis Saisonstart',
    ]);
  });
});

describe('setupCardText', () => {
  const me: NonNullable<Season['me']> = {
    startsOn: '2026-12-07',
    lateEntry: false,
    readyAt: null,
    locked: false,
    missingMetrics: ['trainings_per_week'],
  };
  it('counts down to the start, and warns close to it', () => {
    expect(setupCardText({ name: 'Winter', daysUntilStart: 10, me })).toBe(
      '„Winter“ · noch 10 Tage bis zum Start',
    );
    expect(setupCardText({ name: 'Winter', daysUntilStart: 3, me })).toBe(
      '„Winter“ startet in 3 Tagen – noch nicht bereit',
    );
    expect(setupCardText({ name: 'Winter', daysUntilStart: 1, me })).toBe(
      '„Winter“ startet morgen – noch nicht bereit',
    );
    expect(
      setupCardText({ name: 'Winter', daysUntilStart: -4, me: { ...me, lateEntry: true } }),
    ).toBe('„Winter“ · du steigst später ein');
  });
});
