import { describe, expect, it } from 'vitest';
import {
  missingMetricsText,
  seasonCountdownText,
  seasonErrorText,
  seasonHabitQuotaText,
  seasonHabitRuleText,
  seasonMarkerText,
  seasonPhaseLabel,
  seasonRulesLines,
  seasonWeekText,
} from './format';

const labels: Record<string, string> = {
  trainings_per_week: 'Trainings pro Woche',
  body_weight: 'Körpergewicht',
};
const label = (key: string) => labels[key] ?? key;

describe('seasonWeekText', () => {
  it('shows the week while running, else the length', () => {
    expect(seasonWeekText({ weekNumber: 3, weekCount: 26 })).toBe('Woche 3 von 26');
    expect(seasonWeekText({ weekNumber: null, weekCount: 26 })).toBe('26 Wochen');
    expect(seasonWeekText({ weekNumber: null, weekCount: 1 })).toBe('1 Woche');
  });
});

describe('seasonCountdownText', () => {
  it('counts down to the start, then to the end', () => {
    const at = (phase: 'setup' | 'running' | 'ended', start: number, end: number) =>
      seasonCountdownText({ phase, daysUntilStart: start, daysUntilEnd: end });
    expect(at('setup', 3, 90)).toBe('Start in 3 Tagen');
    expect(at('setup', 1, 90)).toBe('Start morgen');
    expect(at('running', -10, 5)).toBe('Noch 5 Tage bis Saisonende');
    expect(at('running', -10, 1)).toBe('Morgen ist Saisonende');
    expect(at('running', -10, 0)).toBe('Heute ist Saisonende');
    expect(at('ended', -100, -1)).toBe('Beendet');
    expect(seasonPhaseLabel('cancelled')).toBe('Abgesagt');
  });
});

describe('seasonMarkerText', () => {
  it('reads as an upcoming day on Heute', () => {
    expect(seasonMarkerText({ kind: 'season_end', onDate: '2026-12-06' }, '2026-12-01')).toBe(
      'Noch 5 Tage bis Saisonende',
    );
    expect(seasonMarkerText({ kind: 'season_start', onDate: '2026-12-02' }, '2026-12-01')).toBe(
      'Morgen Saisonstart',
    );
    expect(seasonMarkerText({ kind: 'season_end', onDate: '2026-12-01' }, '2026-12-01')).toBe(
      'Heute Saisonende',
    );
    expect(seasonMarkerText({ kind: 'season_start', onDate: '2026-11-01' }, '2026-12-01')).toBe(
      'Saisonstart',
    );
  });
});

describe('rules and setup', () => {
  it('lists the rules', () => {
    expect(
      seasonRulesLines(
        { weighWeekly: true, checkinEveryWeeks: 4, requiredMetrics: ['trainings_per_week'] },
        label,
      ),
    ).toEqual(['Jede Woche wiegen', 'Zwischenstand alle 4 Wochen', 'Pflicht: Trainings pro Woche']);
    expect(
      seasonRulesLines({ weighWeekly: false, checkinEveryWeeks: 1, requiredMetrics: [] }, label),
    ).toEqual(['Zwischenstand jede Woche']);
  });

  it('names what is missing', () => {
    expect(missingMetricsText(['trainings_per_week', 'body_weight'], label)).toBe(
      'Noch offen: Trainings pro Woche, Körpergewicht',
    );
    expect(missingMetricsText([], label)).toBeNull();
  });

  it('turns database errors into German', () => {
    expect(seasonErrorText({ message: 'season_goal_locked' })).toBe(
      'Dieses Saisonziel ist festgeschrieben. Nur ein Admin kann es korrigieren.',
    );
    expect(seasonErrorText(new Error('other'))).toBeNull();
    expect(seasonErrorText(null)).toBeNull();
  });
});

describe('season habits', () => {
  const base = {
    name: 'Schlaf',
    inputType: 'time_pair' as const,
    unit: null,
    rule: [
      { field: 'duration' as const, op: 'min' as const, value: 420 },
      { field: 'start' as const, op: 'before' as const, value: '23:00' },
    ],
    frequency: 'daily' as const,
    weekdays: [],
    timesPerWeek: null,
    timeOfDay: 'evening' as const,
    options: [],
    source: 'manual' as const,
  };

  it('describes the rule', () => {
    expect(seasonHabitRuleText({ definition: base })).toBe(
      'täglich · mind. 7:00 h · ins Bett vor 23:00',
    );
    expect(
      seasonHabitRuleText({
        definition: {
          ...base,
          inputType: 'yes_no',
          rule: [],
          frequency: 'weekly',
          timesPerWeek: 4,
        },
      }),
    ).toBe('4× pro Woche');
  });

  it('says how it went', () => {
    expect(seasonHabitQuotaText({ quotaPct: 62.5, met: 5, counted: 8, countUnit: 'days' })).toBe(
      '63 % · 5 von 8 Tagen',
    );
    expect(seasonHabitQuotaText({ quotaPct: 100, met: 1, counted: 1, countUnit: 'weeks' })).toBe(
      '100 % · 1 von 1 Woche',
    );
    expect(seasonHabitQuotaText({ quotaPct: null, met: 0, counted: 0, countUnit: 'days' })).toBe(
      'Noch nichts gezählt',
    );
  });
});
