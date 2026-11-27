import type { Goal } from '@/features/goals';

/**
 * Seasons (8b): a frame of a group – name, period, setup phase, participants, rules and the
 * goals fixed for that period. Phase, weeks, lock and setup state are computed in SQL
 * (group_seasons, season_participants); the frontend formats them.
 */

/**
 * announced: setup not open yet · setup: participants set their goals (until the start) ·
 * running · ended (after the end date) · cancelled.
 */
export type SeasonPhase = 'announced' | 'setup' | 'running' | 'ended' | 'cancelled';

/** The rules of a season (stored only; adherence is counted in 8c). */
export interface SeasonRules {
  /** Weigh every week. */
  weighWeekly: boolean;
  /** A Zwischenstand every x weeks; null: no rule. */
  checkinEveryWeeks: number | null;
  /** Goal metric keys every participant needs before "Bereit". */
  requiredMetrics: string[];
}

/** My own state in a season (only when I take part). */
export interface MySeasonState {
  /** My season goals start here: the season's start, or my own as a late entrant. */
  startsOn: string;
  /** Added on or after the start: own setup until ready. */
  lateEntry: boolean;
  readyAt: string | null;
  /** My season goals can no longer be changed (from the start; late entrants once ready). */
  locked: boolean;
  /** Required metrics I have no season goal for yet (empty: "Bereit" possible). */
  missingMetrics: string[];
}

export interface Season {
  id: string;
  groupId: string;
  name: string;
  setupOpensOn: string;
  startsOn: string;
  endsOn: string;
  rules: SeasonRules;
  /** Which local day it is for the season (start, lock, pushes). */
  timeZone: string;
  createdBy: string | null;
  cancelledAt: string | null;
  createdAt: string;
  /** As of the day the list was loaded for. */
  phase: SeasonPhase;
  /** While running: week 1 … weekCount; null otherwise. */
  weekNumber: number | null;
  weekCount: number;
  /** startsOn − today (negative once started). */
  daysUntilStart: number;
  /** endsOn − today (negative once ended). */
  daysUntilEnd: number;
  participantCount: number;
  readyCount: number;
  /** null: I do not take part. */
  me: MySeasonState | null;
}

/** A participant with their setup state (season_participants). */
export interface SeasonParticipant {
  userId: string;
  startsOn: string;
  lateEntry: boolean;
  readyAt: string | null;
  addedAt: string;
  locked: boolean;
  missingMetrics: string[];
  /** Season goals (not archived). */
  goalCount: number;
}

/** Which goal of whom belongs to a season (season_goals). */
export interface SeasonGoalLink {
  seasonId: string;
  userId: string;
  goalId: string;
}

/** A participant's season goals with their figures (from the goals module, masked as usual). */
export interface SeasonGoalsOfPerson {
  userId: string;
  goals: Goal[];
}

/** What useCreateSeason takes. */
export interface CreateSeasonInput {
  /** Client-generated (crypto.randomUUID()). */
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  /** null / left out: today. */
  setupOpensOn?: string | null;
  /** null / left out: all group members. */
  participants?: string[] | null;
  weighWeekly: boolean;
  checkinEveryWeeks: number | null;
  /** Left out: the default (trainings per week). */
  requiredMetrics?: string[];
}

/** What useUpdateSeason takes: the full new state (after the start only the name may differ). */
export interface UpdateSeasonInput {
  seasonId: string;
  name: string;
  startsOn: string;
  endsOn: string;
  setupOpensOn: string;
  weighWeekly: boolean;
  checkinEveryWeeks: number | null;
  requiredMetrics: string[];
}

/** What useAddSeasonParticipant takes. */
export interface AddSeasonParticipantInput {
  seasonId: string;
  userId: string;
  /** After the start: the late entrant's own start (default today). */
  startsOn?: string | null;
}

/** What useCorrectSeasonGoal takes (group admins, locked season goals only). */
export interface CorrectSeasonGoalInput {
  goalId: string;
  startValue: number | null;
  minValue: number | null;
  targetValue: number;
  /** Default: the goal's start (the correction applies to the whole season). */
  validFrom?: string | null;
}

export type SeasonDayMarkerKind = 'season_start' | 'season_end';

/** A group's special day from its seasons (season_day_markers). */
export interface SeasonDayMarker {
  onDate: string;
  kind: SeasonDayMarkerKind;
  seasonId: string;
  seasonName: string;
}
