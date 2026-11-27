import {
  addGoalDays,
  periodEnd,
  type Goal,
  type GoalFrame,
  type PeriodChoice,
} from '@/features/goals';
import type { Season, SeasonGoalLink } from './types';

/**
 * Pure helpers for the season screens (admin form, setup flow, goal frames), tested without
 * rendering.
 */

/** Screens of the setup flow, one thing each. */
export type SetupStep = 'frame' | 'training' | 'extra' | 'habits' | 'share' | 'rhythms' | 'summary';

/** The screens for a season: "Rhythmen" only when a rule asks for weighing or a check-in. */
export function setupSteps(rules: Season['rules']): SetupStep[] {
  return [
    'frame',
    'training',
    'extra',
    'habits',
    'share',
    ...(rules.weighWeekly || rules.checkinEveryWeeks !== null ? (['rhythms'] as const) : []),
    'summary',
  ];
}

/** The Monday after `today` (never today itself): a calm default start for a new season. */
export function nextMonday(today: string): string {
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  const ahead = weekday === 1 ? 7 : (8 - weekday) % 7 || 7;
  return addGoalDays(today, ahead);
}

/** What the admin form edits. */
export interface SeasonDraft {
  name: string;
  startsOn: string;
  endsOn: string;
  setupOpensOn: string;
  /** Group members taking part (only when creating; later through the participants sheet). */
  participants: string[];
  weighWeekly: boolean;
  checkinEveryWeeks: number | null;
}

/** Quick choices for a season's length. */
export const SEASON_LENGTHS: { value: PeriodChoice; label: string }[] = [
  { value: '8w', label: '8 Wochen' },
  { value: '12w', label: '12 Wochen' },
  { value: '6m', label: '6 Monate' },
];

/** Zwischenstand rule choices (null: off). */
export const CHECKIN_CHOICES: (number | null)[] = [null, 2, 4, 6, 8];

/** A new season: next Monday for 6 months, setup open today, everyone, weigh weekly. */
export function newSeasonDraft(today: string, memberIds: readonly string[]): SeasonDraft {
  const startsOn = nextMonday(today);
  return {
    name: '',
    startsOn,
    endsOn: periodEnd(startsOn, '6m'),
    setupOpensOn: today,
    participants: [...memberIds],
    weighWeekly: true,
    checkinEveryWeeks: 4,
  };
}

/** An existing season in the form. */
export function seasonDraftOf(season: Season): SeasonDraft {
  return {
    name: season.name,
    startsOn: season.startsOn,
    endsOn: season.endsOn,
    setupOpensOn: season.setupOpensOn,
    participants: [],
    weighWeekly: season.rules.weighWeekly,
    checkinEveryWeeks: season.rules.checkinEveryWeeks,
  };
}

/**
 * What is still wrong with the form (the same rules as the database), null when it can be
 * saved. `started`: only the name counts (the rest can no longer change).
 */
export function validateSeasonDraft(
  draft: SeasonDraft,
  today: string,
  options: { started: boolean; creating: boolean },
): string | null {
  if (draft.name.trim() === '') return 'Gib der Saison einen Namen.';
  if (draft.name.trim().length > 60) return 'Der Name ist zu lang (höchstens 60 Zeichen).';
  if (options.started) return null;
  if (draft.startsOn < today) return 'Der Start darf nicht in der Vergangenheit liegen.';
  if (draft.endsOn <= draft.startsOn) return 'Das Ende muss nach dem Start liegen.';
  if (draft.setupOpensOn > draft.startsOn) return 'Das Einrichten muss spätestens am Start öffnen.';
  if (options.creating && draft.participants.length === 0) return 'Wähl mindestens eine Person.';
  return null;
}

/** Whether the season has started (or is over): then only its name can change. */
export function seasonStarted(season: Pick<Season, 'phase'>): boolean {
  return season.phase === 'running' || season.phase === 'ended';
}

/**
 * How a goal of mine is marked in Ich → Ziele when it belongs to the season: tagged, period
 * fixed, and – once my goals are locked – no changes with a line that says why.
 */
export function seasonGoalFrame(season: Season): GoalFrame {
  const locked = season.me?.locked ?? false;
  return {
    tag: 'Saison',
    name: `Saison „${season.name}“`,
    periodFixed: true,
    lockedNote: locked
      ? season.me?.lateEntry || readyAfterStart(season)
        ? 'Seit du bereit bist fest. Änderungen nur durch den Admin.'
        : 'Seit dem Saisonstart fest. Änderungen nur durch den Admin.'
      : null,
  };
}

/** Whether I tapped "Bereit" after the start day (catching up). */
function readyAfterStart(season: Season): boolean {
  const readyAt = season.me?.readyAt;
  if (!readyAt) return false;
  const d = new Date(readyAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return day > season.startsOn;
}

/** My linked goal ids of a season. */
export function myGoalIds(links: readonly SeasonGoalLink[], userId: string): Set<string> {
  return new Set(links.filter((l) => l.userId === userId).map((l) => l.goalId));
}

/**
 * My goals that could still be taken into the season: running or upcoming, not archived,
 * not linked already (to this season – a goal of another season is refused by the
 * database), and not of a metric the setup asks for itself (trainings, habits).
 */
export function linkableGoals(goals: readonly Goal[], linkedIds: ReadonlySet<string>): Goal[] {
  return goals.filter(
    (g) =>
      g.archivedAt === null &&
      g.phase !== 'ended' &&
      !linkedIds.has(g.id) &&
      g.metric !== 'trainings_per_week' &&
      g.metric !== 'habit_rate',
  );
}

/**
 * How long the setup is still open: "Noch 5 Tage bis zum Start"; once the season runs
 * (catching up): "Die Saison läuft schon".
 */
export function setupDaysLeftText(season: Pick<Season, 'daysUntilStart' | 'phase'>): string {
  const n = season.daysUntilStart;
  if (season.phase === 'running') return 'Die Saison läuft schon';
  if (n <= 0) return 'Start heute';
  if (n === 1) return 'Noch 1 Tag bis zum Start';
  return `Noch ${String(n)} Tage bis zum Start`;
}

const STEP_KEY = 'season.setup.step.';

/** The setup screen I left a season's setup on (remembered on this device only). */
export function readSetupStep(seasonId: string): SetupStep | null {
  try {
    return localStorage.getItem(STEP_KEY + seasonId) as SetupStep | null;
  } catch {
    return null;
  }
}

export function writeSetupStep(seasonId: string, step: SetupStep) {
  try {
    localStorage.setItem(STEP_KEY + seasonId, step);
  } catch {
    // Remembering where I was is a convenience only.
  }
}

/** Whether I have been through the setup before (the block then says "fortsetzen"). */
export function setupStarted(seasonId: string): boolean {
  return readSetupStep(seasonId) !== null;
}

const PROMPTED_KEY = (userId: string, seasonId: string) =>
  `season.setup.prompted.${userId}.${seasonId}`;

/** Whether the setup already opened by itself (or was opened) on this device. */
export function readSetupPrompted(userId: string, seasonId: string): boolean {
  try {
    return localStorage.getItem(PROMPTED_KEY(userId, seasonId)) !== null;
  } catch {
    // Without storage: never open by itself (better than every time).
    return true;
  }
}

export function writeSetupPrompted(userId: string, seasonId: string) {
  try {
    localStorage.setItem(PROMPTED_KEY(userId, seasonId), '1');
  } catch {
    // A convenience only.
  }
}
