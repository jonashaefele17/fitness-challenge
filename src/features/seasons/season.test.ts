import { describe, expect, it } from 'vitest';
import type { Goal } from '@/features/goals';
import {
  applyReady,
  applySeasonUpdate,
  canEditMySeasonGoals,
  canMarkReady,
  catchingUp,
  correctionUndoOf,
  currentSeason,
  daysBetween,
  draftSeason,
  hasStrengthComparison,
  meFirst,
  missingMetrics,
  readyLocks,
  seasonGoalsByPerson,
  seasonPhase,
  seasonTargetPct,
  seasonUpdateOf,
  seasonWeeks,
  setupPending,
  strengthGoalCount,
} from './season';
import type { Season } from './types';

function season(overrides: Partial<Season> = {}): Season {
  return {
    id: 's1',
    groupId: 'g1',
    name: 'Winter',
    setupOpensOn: '2026-12-01',
    startsOn: '2026-12-07',
    endsOn: '2027-05-30',
    rules: { weighWeekly: true, checkinEveryWeeks: 4, requiredMetrics: ['trainings_per_week'] },
    timeZone: 'Europe/Berlin',
    createdBy: 'u1',
    cancelledAt: null,
    createdAt: '2026-12-01T10:00:00Z',
    phase: 'setup',
    weekNumber: null,
    weekCount: 25,
    daysUntilStart: 4,
    daysUntilEnd: 178,
    participantCount: 2,
    readyCount: 0,
    me: {
      startsOn: '2026-12-07',
      lateEntry: false,
      readyAt: null,
      locked: false,
      missingMetrics: ['trainings_per_week'],
    },
    ...overrides,
  };
}

function goal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'g1',
    userId: 'u1',
    metric: 'trainings_per_week',
    metricLabel: 'Trainings pro Woche',
    metricKind: 'rate',
    unit: 'per_week',
    reference: { exerciseId: null, deviceId: null, habitId: null, measurementKind: null },
    referenceLabel: null,
    referenceDetail: null,
    reps: null,
    startsOn: '2026-12-07',
    endsOn: '2027-05-30',
    visibility: 'shared',
    archivedAt: null,
    createdAt: '2026-12-01T10:00:00Z',
    valuesHidden: false,
    evaluatedOn: '2026-12-03',
    phase: 'upcoming',
    startValue: 2,
    minValue: 3,
    targetValue: 4,
    currentValue: null,
    currentOn: null,
    expectedValue: null,
    progressPct: null,
    status: null,
    onTrack: null,
    counted: null,
    minMet: null,
    targetMet: null,
    countUnit: null,
    thisWeek: null,
    bestSet: null,
    ...overrides,
  };
}

describe('daysBetween', () => {
  it('counts whole days, also across the clock change', () => {
    expect(daysBetween('2026-12-01', '2026-12-04')).toBe(3);
    expect(daysBetween('2027-03-27', '2027-03-30')).toBe(3);
    expect(daysBetween('2026-12-04', '2026-12-01')).toBe(-3);
  });
});

describe('seasonPhase', () => {
  const dates = {
    setupOpensOn: '2026-12-03',
    startsOn: '2026-12-07',
    endsOn: '2027-01-03',
    cancelledAt: null,
  };
  it('follows the days like the database', () => {
    expect(seasonPhase(dates, '2026-12-02')).toBe('announced');
    expect(seasonPhase(dates, '2026-12-03')).toBe('setup');
    expect(seasonPhase(dates, '2026-12-07')).toBe('running');
    expect(seasonPhase(dates, '2027-01-03')).toBe('running');
    expect(seasonPhase(dates, '2027-01-04')).toBe('ended');
    expect(seasonPhase({ ...dates, cancelledAt: '2026-12-04T10:00:00Z' }, '2026-12-05')).toBe(
      'cancelled',
    );
  });
});

describe('seasonWeeks', () => {
  it('counts started weeks', () => {
    expect(seasonWeeks('2026-12-07', '2027-01-03', '2026-12-07')).toEqual({
      weekNumber: 1,
      weekCount: 4,
    });
    expect(seasonWeeks('2026-12-07', '2027-01-03', '2026-12-14')).toEqual({
      weekNumber: 2,
      weekCount: 4,
    });
    expect(seasonWeeks('2026-12-07', '2027-01-04', '2027-01-04')).toEqual({
      weekNumber: 5,
      weekCount: 5,
    });
    expect(seasonWeeks('2026-12-07', '2027-01-03', '2026-12-06').weekNumber).toBeNull();
  });
});

describe('currentSeason', () => {
  it('prefers running, then the next to come, then the last ended; never cancelled', () => {
    const ended = season({ id: 'old', phase: 'ended', endsOn: '2026-06-30' });
    const older = season({ id: 'older', phase: 'ended', endsOn: '2025-06-30' });
    const next = season({ id: 'next', phase: 'announced', startsOn: '2027-07-01' });
    const soon = season({ id: 'soon', phase: 'setup', startsOn: '2027-01-01' });
    const running = season({ id: 'run', phase: 'running' });
    const cancelled = season({ id: 'x', phase: 'cancelled' });
    expect(currentSeason([cancelled, next, soon, running, ended])?.id).toBe('run');
    expect(currentSeason([cancelled, next, soon, ended])?.id).toBe('soon');
    expect(currentSeason([older, cancelled, ended])?.id).toBe('old');
    expect(currentSeason([cancelled])).toBeNull();
  });
});

describe('setup state', () => {
  it('lets me edit during the setup and after the start until locked, late entrants too', () => {
    expect(canEditMySeasonGoals(season())).toBe(true);
    expect(canEditMySeasonGoals(season({ phase: 'announced' }))).toBe(false);
    expect(canEditMySeasonGoals(season({ me: null }))).toBe(false);
    expect(canEditMySeasonGoals(season({ phase: 'ended' }))).toBe(false);
    // Not ready at the start: catching up until "Bereit".
    const catchUp = season({ phase: 'running', daysUntilStart: -2 });
    expect(canEditMySeasonGoals(catchUp)).toBe(true);
    expect(catchingUp(catchUp)).toBe(true);
    expect(setupPending(catchUp)).toBe(true);
    const locked = season({
      phase: 'running',
      me: {
        startsOn: '2026-12-07',
        lateEntry: false,
        readyAt: '2026-12-06T10:00:00Z',
        locked: true,
        missingMetrics: [],
      },
    });
    expect(canEditMySeasonGoals(locked)).toBe(false);
    expect(catchingUp(locked)).toBe(false);
    expect(setupPending(locked)).toBe(false);
    expect(catchingUp(season())).toBe(false);
    const late = season({
      phase: 'running',
      me: {
        startsOn: '2026-12-20',
        lateEntry: true,
        readyAt: null,
        locked: false,
        missingMetrics: [],
      },
    });
    expect(canEditMySeasonGoals(late)).toBe(true);
    expect(canMarkReady(late)).toBe(true);
    expect(canMarkReady(season())).toBe(false);
  });

  it('marks ready optimistically; a late entrant locks', () => {
    const ready = applyReady(season(), true, '2026-12-03T08:00:00Z');
    expect(ready.me?.readyAt).toBe('2026-12-03T08:00:00Z');
    expect(ready.readyCount).toBe(1);
    expect(ready.me?.locked).toBe(false);
    expect(applyReady(ready, false, 'x').readyCount).toBe(0);
    const late = season({
      me: {
        startsOn: '2026-12-20',
        lateEntry: true,
        readyAt: null,
        locked: false,
        missingMetrics: [],
      },
    });
    expect(applyReady(late, true, 'now').me?.locked).toBe(true);
    expect(readyLocks(late)).toBe(true);
    expect(readyLocks(season())).toBe(false);
    // Catching up after the start: ready locks at once.
    const catchUp = season({
      phase: 'running',
      me: {
        startsOn: '2026-12-07',
        lateEntry: false,
        readyAt: null,
        locked: false,
        missingMetrics: [],
      },
    });
    expect(readyLocks(catchUp)).toBe(true);
    expect(applyReady(catchUp, true, 'now').me?.locked).toBe(true);
  });

  it('knows which required metrics are still missing', () => {
    expect(missingMetrics(['trainings_per_week', 'body_weight'], ['body_weight'])).toEqual([
      'trainings_per_week',
    ]);
    expect(missingMetrics(['trainings_per_week'], ['trainings_per_week', 'habit_rate'])).toEqual(
      [],
    );
  });
});

describe('drafts and updates', () => {
  it('drafts a new season as the database would show it', () => {
    const draft = draftSeason(
      {
        id: 's2',
        name: ' Sommer ',
        startsOn: '2026-12-10',
        endsOn: '2027-01-06',
        weighWeekly: false,
        checkinEveryWeeks: null,
      },
      {
        groupId: 'g1',
        userId: 'u1',
        today: '2026-12-03',
        timeZone: 'Europe/Berlin',
        memberIds: ['u1', 'u2', 'u3'],
        defaultRequiredMetrics: ['trainings_per_week'],
      },
    );
    expect(draft).toMatchObject({
      name: 'Sommer',
      setupOpensOn: '2026-12-03',
      phase: 'setup',
      weekCount: 4,
      daysUntilStart: 7,
      participantCount: 3,
      rules: {
        weighWeekly: false,
        checkinEveryWeeks: null,
        requiredMetrics: ['trainings_per_week'],
      },
      me: { startsOn: '2026-12-10', missingMetrics: ['trainings_per_week'], readyAt: null },
    });
  });

  it('applies an update and gives the update back for undo', () => {
    const before = season();
    const input = { ...seasonUpdateOf(before), name: 'Winter 26/27', startsOn: '2026-12-08' };
    const after = applySeasonUpdate(before, input, '2026-12-03');
    expect(after.name).toBe('Winter 26/27');
    expect(after.daysUntilStart).toBe(5);
    expect(after.me?.startsOn).toBe('2026-12-08');
    expect(seasonUpdateOf(before)).toEqual({
      seasonId: 's1',
      name: 'Winter',
      startsOn: '2026-12-07',
      endsOn: '2027-05-30',
      setupOpensOn: '2026-12-01',
      weighWeekly: true,
      checkinEveryWeeks: 4,
      requiredMetrics: ['trainings_per_week'],
    });
  });
});

describe('season goals', () => {
  it('groups the linked goals per participant, in their order', () => {
    const links = [
      { seasonId: 's1', userId: 'u2', goalId: 'a' },
      { seasonId: 's1', userId: 'u1', goalId: 'b' },
    ];
    const goals: Record<string, Goal[]> = {
      u1: [goal({ id: 'b' }), goal({ id: 'private' })],
      u2: [goal({ id: 'a', userId: 'u2' })],
    };
    const result = seasonGoalsByPerson(['u1', 'u2', 'u3'], links, (id) => goals[id]);
    expect(result.map((p) => [p.userId, p.goals.map((g) => g.id)])).toEqual([
      ['u1', ['b']],
      ['u2', ['a']],
      ['u3', []],
    ]);
  });

  it('undoes a correction only with visible values', () => {
    expect(correctionUndoOf(goal())).toEqual({
      goalId: 'g1',
      startValue: 2,
      minValue: 3,
      targetValue: 4,
    });
    expect(correctionUndoOf(goal({ valuesHidden: true }))).toBeNull();
  });
});

describe('seasonTargetPct', () => {
  const frame = { startsOn: '2026-11-30', endsOn: '2027-02-21' };
  it('runs straight from 0 % at the start to 100 % at the end', () => {
    expect(seasonTargetPct(frame, '2026-11-30')).toBe(0);
    expect(seasonTargetPct(frame, '2027-02-21')).toBe(100);
    expect(seasonTargetPct(frame, '2026-12-23')).toBeCloseTo((23 / 83) * 100);
  });
  it('stays inside 0 … 100 %', () => {
    expect(seasonTargetPct(frame, '2026-11-01')).toBe(0);
    expect(seasonTargetPct(frame, '2027-03-01')).toBe(100);
  });
});

describe('meFirst', () => {
  it('puts me first and keeps the others in their order', () => {
    const rows = [{ userId: 'a' }, { userId: 'me' }, { userId: 'b' }];
    expect(meFirst(rows, 'me').map((r) => r.userId)).toEqual(['me', 'a', 'b']);
  });
});

describe('strength', () => {
  const goal = (metric: string) => ({ goalId: metric, metric, status: null, onTrack: null });
  const row = (...metrics: string[]) => ({ goals: metrics.map(goal) });

  it('counts the strength goals of a participant', () => {
    expect(strengthGoalCount(row('exercise_best', 'body_weight', 'exercise_best'))).toBe(2);
    expect(strengthGoalCount(row('trainings_per_week'))).toBe(0);
  });

  it('is a view once two participants have a strength goal', () => {
    expect(hasStrengthComparison([row('exercise_best'), row('exercise_best')])).toBe(true);
    expect(hasStrengthComparison([row('exercise_best', 'exercise_best'), row()])).toBe(false);
    expect(hasStrengthComparison(undefined)).toBe(false);
  });
});
