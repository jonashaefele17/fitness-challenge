import type { Goal } from '@/features/goals';
import type {
  CorrectSeasonGoalInput,
  CreateSeasonInput,
  Season,
  SeasonGoalLink,
  SeasonGoalsOfPerson,
  SeasonPhase,
  UpdateSeasonInput,
} from './types';

/** Whole days from `from` to `to` (local days "2026-12-01"; negative: before). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** The phase on a day – the same rule as group_seasons in the database. */
export function seasonPhase(
  season: Pick<Season, 'setupOpensOn' | 'startsOn' | 'endsOn' | 'cancelledAt'>,
  today: string,
): SeasonPhase {
  if (season.cancelledAt !== null) return 'cancelled';
  if (today > season.endsOn) return 'ended';
  if (today >= season.startsOn) return 'running';
  if (today >= season.setupOpensOn) return 'setup';
  return 'announced';
}

/** Week x (while running, else null) of y – the same rule as group_seasons. */
export function seasonWeeks(
  startsOn: string,
  endsOn: string,
  today: string,
): { weekNumber: number | null; weekCount: number } {
  const weekCount = Math.floor(daysBetween(startsOn, endsOn) / 7) + 1;
  const running = today >= startsOn && today <= endsOn;
  return {
    weekNumber: running ? Math.floor(daysBetween(startsOn, today) / 7) + 1 : null,
    weekCount,
  };
}

/** Phase, weeks and countdowns of a season for a day. */
function computed(
  season: Pick<Season, 'setupOpensOn' | 'startsOn' | 'endsOn' | 'cancelledAt'>,
  today: string,
) {
  return {
    phase: seasonPhase(season, today),
    ...seasonWeeks(season.startsOn, season.endsOn, today),
    daysUntilStart: daysBetween(today, season.startsOn),
    daysUntilEnd: daysBetween(today, season.endsOn),
  };
}

/**
 * The season the group is in: the running one, else the next one to come (setup or
 * announced), else the one that ended last; cancelled ones never. null: none.
 */
export function currentSeason(seasons: readonly Season[]): Season | null {
  const live = seasons.filter((s) => s.phase !== 'cancelled');
  const running = live.find((s) => s.phase === 'running');
  if (running) return running;
  const next = live
    .filter((s) => s.phase === 'setup' || s.phase === 'announced')
    .sort((a, b) => (a.startsOn < b.startsOn ? -1 : a.startsOn > b.startsOn ? 1 : 0))[0];
  if (next) return next;
  return (
    live
      .filter((s) => s.phase === 'ended')
      .sort((a, b) => (a.endsOn > b.endsOn ? -1 : a.endsOn < b.endsOn ? 1 : 0))[0] ?? null
  );
}

/**
 * Whether I can still set goals for the season: my goals are not locked (the database's
 * rule: locked once the season has started and I am ready; late entrants once ready), and
 * the setup is open or the season runs (catching up when I missed the start).
 */
export function canEditMySeasonGoals(season: Season): boolean {
  if (!season.me || season.me.locked) return false;
  if (season.phase === 'cancelled' || season.phase === 'ended') return false;
  return season.me.lateEntry || season.phase === 'setup' || season.phase === 'running';
}

/** Whether "Bereit" can be tapped: my setup is open and no required metric is missing. */
export function canMarkReady(season: Season): boolean {
  return canEditMySeasonGoals(season) && season.me?.missingMetrics.length === 0;
}

/** Whether my setup is open and I am not ready yet (Heute card, auto-open, block action). */
export function setupPending(season: Season): boolean {
  return canEditMySeasonGoals(season) && season.me?.readyAt === null;
}

/**
 * Whether I am catching up: the season runs, I am not a late entrant and my goals are not
 * locked – I was not ready at the start. "Bereit" then locks my goals at once.
 */
export function catchingUp(season: Season): boolean {
  return (
    season.phase === 'running' && season.me !== null && !season.me.lateEntry && !season.me.locked
  );
}

/** Whether "Bereit" locks my goals at once (the season runs, or I entered late). */
export function readyLocks(season: Pick<Season, 'phase' | 'me'>): boolean {
  return (season.me?.lateEntry ?? false) || season.phase === 'running';
}

/** How a new season shows until the database has computed it (optimistic create). */
export function draftSeason(
  input: CreateSeasonInput,
  context: {
    groupId: string;
    userId: string;
    today: string;
    timeZone: string;
    /** The group's members (participants by default). */
    memberIds: readonly string[];
    /** The default required metrics (the database's) when the input has none. */
    defaultRequiredMetrics: readonly string[];
  },
): Season {
  const participants = input.participants ?? context.memberIds;
  const requiredMetrics = [...(input.requiredMetrics ?? context.defaultRequiredMetrics)];
  const dates = {
    setupOpensOn: input.setupOpensOn ?? context.today,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    cancelledAt: null,
  };
  const takesPart = participants.includes(context.userId);
  return {
    id: input.id,
    groupId: context.groupId,
    name: input.name.trim(),
    ...dates,
    rules: {
      weighWeekly: input.weighWeekly,
      checkinEveryWeeks: input.checkinEveryWeeks,
      requiredMetrics,
    },
    timeZone: context.timeZone,
    createdBy: context.userId,
    createdAt: new Date().toISOString(),
    ...computed(dates, context.today),
    participantCount: participants.length,
    readyCount: 0,
    me: takesPart
      ? {
          startsOn: input.startsOn,
          lateEntry: false,
          readyAt: null,
          locked: false,
          missingMetrics: requiredMetrics,
        }
      : null,
  };
}

/** A season with an update applied (optimistic; the database recomputes the rest). */
export function applySeasonUpdate(season: Season, input: UpdateSeasonInput, today: string): Season {
  const dates = {
    setupOpensOn: input.setupOpensOn,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    cancelledAt: season.cancelledAt,
  };
  return {
    ...season,
    name: input.name.trim(),
    ...dates,
    rules: {
      weighWeekly: input.weighWeekly,
      checkinEveryWeeks: input.checkinEveryWeeks,
      requiredMetrics: [...input.requiredMetrics],
    },
    ...computed(dates, today),
    me: season.me && {
      ...season.me,
      startsOn: season.me.lateEntry ? season.me.startsOn : input.startsOn,
    },
  };
}

/** The update that brings a season back to how it was ("Rückgängig" after changing it). */
export function seasonUpdateOf(season: Season): UpdateSeasonInput {
  return {
    seasonId: season.id,
    name: season.name,
    startsOn: season.startsOn,
    endsOn: season.endsOn,
    setupOpensOn: season.setupOpensOn,
    weighWeekly: season.rules.weighWeekly,
    checkinEveryWeeks: season.rules.checkinEveryWeeks,
    requiredMetrics: [...season.rules.requiredMetrics],
  };
}

/** A season with my ready state changed (optimistic). */
export function applyReady(season: Season, ready: boolean, now: string): Season {
  if (!season.me) return season;
  const wasReady = season.me.readyAt !== null;
  return {
    ...season,
    readyCount: season.readyCount + (ready === wasReady ? 0 : ready ? 1 : -1),
    me: {
      ...season.me,
      readyAt: ready ? (season.me.readyAt ?? now) : null,
      // Ready locks once the season runs (catching up) and for a late entrant.
      locked: season.me.locked || (ready && readyLocks(season)),
    },
  };
}

/**
 * The required metrics still missing when my season goals are these metrics (optimistic
 * after linking or unlinking), in the season's order.
 */
export function missingMetrics(
  requiredMetrics: readonly string[],
  goalMetrics: readonly string[],
): string[] {
  return requiredMetrics.filter((metric) => !goalMetrics.includes(metric));
}

/**
 * The season goals per participant, in the participants' order: each person's linked goals
 * as the goals module returns them (people without goals get an empty list; a goal not
 * loaded yet is left out).
 */
export function seasonGoalsByPerson(
  participantIds: readonly string[],
  links: readonly SeasonGoalLink[],
  goalsOf: (userId: string) => readonly Goal[] | undefined,
): SeasonGoalsOfPerson[] {
  return participantIds.map((userId) => {
    const ids = new Set(links.filter((l) => l.userId === userId).map((l) => l.goalId));
    return {
      userId,
      goals: (goalsOf(userId) ?? []).filter((goal) => ids.has(goal.id)),
    };
  });
}

/**
 * The correction that puts a goal's values back as they were ("Rückgängig" after an admin
 * correction). null when the values are hidden from me (weight not shared in kg, body
 * measurements) or there is no target.
 */
export function correctionUndoOf(goal: Goal): CorrectSeasonGoalInput | null {
  if (goal.valuesHidden || goal.targetValue === null) return null;
  return {
    goalId: goal.id,
    startValue: goal.startValue,
    minValue: goal.minValue,
    targetValue: goal.targetValue,
  };
}
