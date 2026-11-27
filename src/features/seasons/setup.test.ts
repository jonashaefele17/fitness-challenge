import { describe, expect, it } from 'vitest';
import type { Goal } from '@/features/goals';
import {
  linkableGoals,
  myGoalIds,
  newSeasonDraft,
  nextMonday,
  seasonGoalFrame,
  setupDaysLeftText,
  setupSteps,
  validateSeasonDraft,
} from './setup';
import type { Season } from './types';

const season = {
  id: 's1',
  name: 'Winterform',
  phase: 'setup',
  daysUntilStart: 5,
  rules: { weighWeekly: true, checkinEveryWeeks: 4, requiredMetrics: ['trainings_per_week'] },
  me: {
    startsOn: '2026-12-07',
    lateEntry: false,
    readyAt: null,
    locked: false,
    missingMetrics: ['trainings_per_week'],
  },
} as unknown as Season;

describe('setupSteps', () => {
  it('asks for rhythms only when a rule needs them', () => {
    expect(setupSteps(season.rules)).toEqual([
      'frame',
      'training',
      'extra',
      'habits',
      'share',
      'rhythms',
      'summary',
    ]);
    expect(
      setupSteps({ weighWeekly: false, checkinEveryWeeks: null, requiredMetrics: [] }),
    ).not.toContain('rhythms');
  });
});

describe('nextMonday', () => {
  it('is the Monday after today, never today', () => {
    expect(nextMonday('2026-11-27')).toBe('2026-11-30'); // Friday
    expect(nextMonday('2026-11-29')).toBe('2026-11-30'); // Sunday
    expect(nextMonday('2026-11-30')).toBe('2026-12-07'); // Monday
  });
});

describe('validateSeasonDraft', () => {
  const today = '2026-11-27';
  const draft = { ...newSeasonDraft(today, ['a', 'b']), name: 'Winterform' };

  it('starts next Monday for six months with everyone', () => {
    expect(draft.startsOn).toBe('2026-11-30');
    expect(draft.endsOn).toBe('2027-05-29');
    expect(draft.setupOpensOn).toBe(today);
    expect(draft.participants).toEqual(['a', 'b']);
    expect(validateSeasonDraft(draft, today, { started: false, creating: true })).toBeNull();
  });

  it('says what is wrong', () => {
    const check = (patch: Partial<typeof draft>) =>
      validateSeasonDraft({ ...draft, ...patch }, today, { started: false, creating: true });
    expect(check({ name: ' ' })).toBe('Gib der Saison einen Namen.');
    expect(check({ startsOn: '2026-11-26' })).toMatch(/Vergangenheit/);
    expect(check({ endsOn: '2026-11-30' })).toMatch(/Ende/);
    expect(check({ setupOpensOn: '2026-12-01' })).toMatch(/Einrichten/);
    expect(check({ participants: [] })).toMatch(/Person/);
  });

  it('after the start only checks the name', () => {
    expect(
      validateSeasonDraft({ ...draft, startsOn: '2026-01-01' }, today, {
        started: true,
        creating: false,
      }),
    ).toBeNull();
  });
});

describe('seasonGoalFrame', () => {
  it('fixes the period and locks with a reason once locked', () => {
    expect(seasonGoalFrame(season)).toEqual({
      tag: 'Saison',
      name: 'Saison „Winterform“',
      periodFixed: true,
      lockedNote: null,
    });
    const locked = { ...season, me: { ...season.me, locked: true } } as Season;
    expect(seasonGoalFrame(locked).lockedNote).toBe(
      'Seit dem Saisonstart fest. Änderungen nur durch den Admin.',
    );
    const late = { ...season, me: { ...season.me, locked: true, lateEntry: true } } as Season;
    expect(seasonGoalFrame(late).lockedNote).toMatch(/bereit/);
  });
});

describe('linkableGoals', () => {
  const goal = (patch: Partial<Goal>) =>
    ({ id: 'g', metric: 'body_weight', archivedAt: null, phase: 'running', ...patch }) as Goal;
  it('offers my running goals that are not in the season and not asked for elsewhere', () => {
    const goals = [
      goal({ id: 'weight' }),
      goal({ id: 'linked' }),
      goal({ id: 'ended', phase: 'ended' }),
      goal({ id: 'archived', archivedAt: '2026-11-01' }),
      goal({ id: 'trainings', metric: 'trainings_per_week' }),
      goal({ id: 'habit', metric: 'habit_rate' }),
    ];
    const ids = myGoalIds([{ seasonId: 's1', userId: 'me', goalId: 'linked' }], 'me');
    expect(linkableGoals(goals, ids).map((g) => g.id)).toEqual(['weight']);
  });
});

describe('setupDaysLeftText', () => {
  it('counts the days to the start', () => {
    expect(setupDaysLeftText({ daysUntilStart: 5 })).toBe('Noch 5 Tage bis zum Start');
    expect(setupDaysLeftText({ daysUntilStart: 1 })).toBe('Noch 1 Tag bis zum Start');
    expect(setupDaysLeftText({ daysUntilStart: 0 })).toBe('Start heute');
  });
});
