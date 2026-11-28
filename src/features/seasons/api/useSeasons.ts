import {
  queryOptions,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { useUserId } from '@/features/auth';
import {
  goalKeys,
  goalListOptions,
  goalTodayKey,
  type Goal,
  type GoalStatus,
} from '@/features/goals';
import { useActiveGroup, useGroupMembers } from '@/features/groups';
import type { HabitCondition, HabitDefinition, HabitOption } from '@/features/habits';
import { supabase } from '@/shared/lib/supabase';
import type { Database, Json } from '@/shared/types/database';
import {
  applyReady,
  applySeasonUpdate,
  currentSeason,
  draftSeason,
  seasonGoalsByPerson,
  seasonPhase,
} from '../season';
import type {
  AddSeasonParticipantInput,
  CorrectSeasonGoalInput,
  CreateSeasonInput,
  Season,
  SeasonDayMarker,
  SeasonGoalDot,
  SeasonGoalLink,
  SeasonGoalsOfPerson,
  SeasonHabit,
  SeasonHabitWeek,
  SeasonOverviewRow,
  SeasonParticipant,
  SeasonPhase,
  SeasonProgressPoint,
  SeasonStrengthPoint,
  UpdateSeasonInput,
} from '../types';
import { seasonKeys } from './keys';

type SeasonRow = Database['public']['Functions']['group_seasons']['Returns'][number];

/** The database's default required metrics (seasons.required_metrics), for the draft only. */
const DEFAULT_REQUIRED_METRICS = ['trainings_per_week'];

/** The generated types do not know that computed columns may be null. */
const orNull = <T>(v: T | null | undefined): T | null => v ?? null;

function toPhase(value: string): SeasonPhase {
  return value === 'announced' ||
    value === 'setup' ||
    value === 'running' ||
    value === 'ended' ||
    value === 'cancelled'
    ? value
    : 'ended';
}

function toSeason(row: SeasonRow): Season {
  return {
    id: row.id,
    groupId: row.group_id,
    name: row.name,
    setupOpensOn: row.setup_opens_on,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    rules: {
      weighWeekly: row.weigh_weekly,
      checkinEveryWeeks: orNull(row.checkin_every_weeks),
      requiredMetrics: row.required_metrics,
    },
    timeZone: row.time_zone,
    createdBy: orNull(row.created_by),
    cancelledAt: orNull(row.cancelled_at),
    createdAt: row.created_at,
    phase: toPhase(row.phase),
    weekNumber: orNull(row.week_number),
    weekCount: row.week_count,
    daysUntilStart: row.days_until_start,
    daysUntilEnd: row.days_until_end,
    participantCount: row.participant_count,
    readyCount: row.ready_count,
    me: row.is_participant
      ? {
          startsOn: row.my_starts_on,
          lateEntry: row.my_late_entry,
          readyAt: orNull(row.my_ready_at),
          locked: row.my_locked,
          missingMetrics: row.my_missing_metrics,
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

function seasonsOptions(groupId: string, today: string) {
  return queryOptions({
    queryKey: seasonKeys.list(groupId, today),
    queryFn: async (): Promise<Season[]> => {
      const { data, error } = await supabase.rpc('group_seasons', {
        p_group_id: groupId,
        p_today: today,
      });
      if (error) throw error;
      return data.map(toSeason);
    },
  });
}

/** All seasons of the active group (newest start first), computed for today. */
export function useSeasons() {
  const { group } = useActiveGroup();
  return useQuery(seasonsOptions(group.id, goalTodayKey()));
}

/**
 * The season the active group is in (see currentSeason: running, else the next one, else
 * the one that ended last); data null: none. Same cache as useSeasons.
 */
export function useCurrentSeason() {
  const { group } = useActiveGroup();
  return useQuery({ ...seasonsOptions(group.id, goalTodayKey()), select: currentSeason });
}

/** The participants of a season with their setup state (null seasonId: disabled). */
export function useSeasonParticipants(seasonId: string | null) {
  const { group } = useActiveGroup();
  return useQuery({
    queryKey: seasonKeys.participants(group.id, seasonId ?? ''),
    enabled: seasonId !== null,
    queryFn: async (): Promise<SeasonParticipant[]> => {
      const { data, error } = await supabase.rpc('season_participants', {
        p_season_id: seasonId ?? '',
      });
      if (error) throw error;
      return data.map((row) => ({
        userId: row.user_id,
        startsOn: row.starts_on,
        lateEntry: row.late_entry,
        readyAt: orNull(row.ready_at),
        addedAt: row.added_at,
        locked: row.locked,
        missingMetrics: row.missing_metrics,
        goalCount: row.goal_count,
      }));
    },
  });
}

/** Which goals of whom belong to a season (null seasonId: disabled). */
export function useSeasonGoalLinks(seasonId: string | null) {
  const { group } = useActiveGroup();
  return useQuery({
    queryKey: seasonKeys.goalLinks(group.id, seasonId ?? ''),
    enabled: seasonId !== null,
    queryFn: async (): Promise<SeasonGoalLink[]> => {
      const { data, error } = await supabase
        .from('season_goals')
        .select('season_id, user_id, goal_id')
        .eq('season_id', seasonId ?? '')
        .order('created_at');
      if (error) throw error;
      return data.map((row) => ({
        seasonId: row.season_id,
        userId: row.user_id,
        goalId: row.goal_id,
      }));
    },
  });
}

/**
 * The season goals of every participant with their figures, in the participants' order.
 * The figures come from the goals module (goal_progress), masked as for everyone: weight
 * kg only when the person shares them (Goal.valuesHidden), body measurements never.
 */
export function useSeasonGoals(seasonId: string | null): {
  data: SeasonGoalsOfPerson[] | undefined;
  isPending: boolean;
  isError: boolean;
} {
  const userId = useUserId();
  const today = goalTodayKey();
  const participants = useSeasonParticipants(seasonId);
  const links = useSeasonGoalLinks(seasonId);
  const people = participants.data?.map((p) => p.userId) ?? [];
  const withGoals = people.filter((id) => links.data?.some((l) => l.userId === id));
  const goals = useQueries({
    queries: withGoals.map((personId) => goalListOptions(userId, personId, today)),
  });
  const byPerson = new Map<string, Goal[] | undefined>(
    withGoals.map((personId, index) => [personId, goals[index]?.data]),
  );
  return {
    data:
      participants.data && links.data
        ? seasonGoalsByPerson(people, links.data, (personId) => byPerson.get(personId))
        : undefined,
    isPending: participants.isPending || links.isPending || goals.some((q) => q.isPending),
    isError: participants.isError || links.isError || goals.some((q) => q.isError),
  };
}

function toSeasonHabit(
  row: Database['public']['Functions']['season_habits_overview']['Returns'][number],
): SeasonHabit {
  return {
    userId: row.user_id,
    habitId: row.habit_id,
    definition: {
      name: row.name,
      inputType: row.input_type as HabitDefinition['inputType'],
      unit: orNull(row.unit),
      rule: row.rule as unknown as HabitCondition[],
      frequency: row.frequency as HabitDefinition['frequency'],
      weekdays: row.weekdays,
      timesPerWeek: orNull(row.times_per_week),
      // Not part of the rule; the overview does not carry it.
      timeOfDay: 'evening',
      options: row.options as unknown as HabitOption[],
      source: row.source as HabitDefinition['source'],
    },
    counted: row.counted,
    met: row.met,
    quotaPct: orNull(row.quota_pct),
    countUnit: row.count_unit === 'weeks' ? 'weeks' : 'days',
    locked: row.locked,
    editOpenUntil: orNull(row.edit_open_until),
  };
}

/**
 * The season habits of all participants: name, rule and how it went since each one's start
 * (null seasonId: disabled).
 */
export function useSeasonHabits(seasonId: string | null) {
  const { group } = useActiveGroup();
  const today = goalTodayKey();
  return useQuery({
    queryKey: seasonKeys.habits(group.id, seasonId ?? '', today),
    enabled: seasonId !== null,
    queryFn: async (): Promise<SeasonHabit[]> => {
      const { data, error } = await supabase.rpc('season_habits_overview', {
        p_season_id: seasonId ?? '',
        p_today: today,
        p_time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      if (error) throw error;
      return data.map(toSeasonHabit);
    },
  });
}

const GOAL_STATUSES: readonly GoalStatus[] = [
  'target_reached',
  'min_reached',
  'below_min',
  'not_reached',
];

function toGoalDots(value: Json): SeasonGoalDot[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return [];
    const status = GOAL_STATUSES.find((s) => s === item.status) ?? null;
    return typeof item.goal_id === 'string' && typeof item.metric === 'string'
      ? [
          {
            goalId: item.goal_id,
            metric: item.metric,
            status,
            onTrack: typeof item.on_track === 'boolean' ? item.on_track : null,
          },
        ]
      : [];
  });
}

const ruleCount = (done: number | null | undefined, due: number | null | undefined) =>
  done === null || done === undefined || due === null || due === undefined ? null : { done, due };

/**
 * How every participant is doing in a season (trainings weeks, goal statuses, habit quota,
 * the season's rules), in the participants' order (null seasonId: disabled).
 */
export function useSeasonOverview(seasonId: string | null) {
  const { group } = useActiveGroup();
  const today = goalTodayKey();
  return useQuery({
    queryKey: seasonKeys.overview(group.id, seasonId ?? '', today),
    enabled: seasonId !== null,
    queryFn: async (): Promise<SeasonOverviewRow[]> => {
      const { data, error } = await supabase.rpc('season_overview', {
        p_season_id: seasonId ?? '',
        p_today: today,
        p_time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      if (error) throw error;
      return data.map((row) => {
        const counted = orNull(row.training_weeks);
        const met = orNull(row.training_weeks_met);
        return {
          userId: row.user_id,
          startsOn: row.starts_on,
          trainingWeeks: counted === null || met === null ? null : { counted, met },
          goals: toGoalDots(row.goals),
          habitCount: row.habit_count,
          habitQuotaPct: orNull(row.habit_quota_pct),
          weighed: ruleCount(row.weigh_weeks_done, row.weigh_weeks_due),
          checkins: ruleCount(row.checkins_done, row.checkins_due),
        };
      });
    },
  });
}

/**
 * Every participant's mean goal progress (level goals, 0 … 100 %) at the season's week ends
 * and today; whoever has no such goal has no points (null seasonId: disabled).
 */
export function useSeasonProgressWeeks(seasonId: string | null) {
  const { group } = useActiveGroup();
  const today = goalTodayKey();
  return useQuery({
    queryKey: seasonKeys.progress(group.id, seasonId ?? '', today),
    enabled: seasonId !== null,
    queryFn: async (): Promise<SeasonProgressPoint[]> => {
      const { data, error } = await supabase.rpc('season_progress_weeks', {
        p_season_id: seasonId ?? '',
        p_today: today,
        p_time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      if (error) throw error;
      return data.map((row) => ({
        userId: row.user_id,
        onDate: row.on_date,
        progressPct: row.goal_progress_pct,
      }));
    },
  });
}

/**
 * Every participant's quota of their season habits per calendar week, from their start
 * (private habits too – only the quota arrives); a week in which nothing counted has no
 * point (null seasonId: disabled).
 */
export function useSeasonHabitWeeks(seasonId: string | null) {
  const { group } = useActiveGroup();
  const today = goalTodayKey();
  return useQuery({
    queryKey: seasonKeys.habitWeeks(group.id, seasonId ?? '', today),
    enabled: seasonId !== null,
    queryFn: async (): Promise<SeasonHabitWeek[]> => {
      const { data, error } = await supabase.rpc('season_habit_weeks', {
        p_season_id: seasonId ?? '',
        p_today: today,
        p_time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      if (error) throw error;
      return data.map((row) => ({
        userId: row.user_id,
        weekStart: row.week_start,
        quotaPct: row.quota_pct,
      }));
    },
  });
}

/**
 * Every participant's mean increase over their strength goals since the start, in %, at
 * the season's week ends and today; whoever has no strength goal has no points (null
 * seasonId: disabled).
 */
export function useSeasonStrengthWeeks(seasonId: string | null) {
  const { group } = useActiveGroup();
  const today = goalTodayKey();
  return useQuery({
    queryKey: seasonKeys.strength(group.id, seasonId ?? '', today),
    enabled: seasonId !== null,
    queryFn: async (): Promise<SeasonStrengthPoint[]> => {
      const { data, error } = await supabase.rpc('season_strength_weeks', {
        p_season_id: seasonId ?? '',
        p_today: today,
        p_time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      if (error) throw error;
      return data.map((row) => ({
        userId: row.user_id,
        onDate: row.on_date,
        strengthPct: row.strength_pct,
      }));
    },
  });
}

/** The active group's season start and end days in a range (calendar, Heute). */
export function useSeasonDayMarkers(from: string, to: string) {
  const { group } = useActiveGroup();
  return useQuery({
    queryKey: seasonKeys.markers(group.id, from, to),
    queryFn: async (): Promise<SeasonDayMarker[]> => {
      const { data, error } = await supabase.rpc('season_day_markers', {
        p_group_id: group.id,
        p_from: from,
        p_to: to,
      });
      if (error) throw error;
      return data.map((row) => ({
        onDate: row.on_date,
        kind: row.kind === 'season_start' ? 'season_start' : 'season_end',
        seasonId: row.season_id,
        seasonName: row.season_name,
      }));
    },
  });
}

// ---------------------------------------------------------------------------
// Changes (optimistic where cheap, with rollback)
// ---------------------------------------------------------------------------

type Snapshot = [QueryKey, unknown][];

/** Optimistic changes to the cached season data of the active group. */
function useSeasonCache() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  const { group } = useActiveGroup();
  const groupId = group.id;
  return {
    groupId,
    userId,
    async changeLists(change: (list: Season[]) => Season[]): Promise<Snapshot> {
      const key = seasonKeys.lists(groupId);
      await queryClient.cancelQueries({ queryKey: key });
      const snapshots = queryClient.getQueriesData<Season[]>({ queryKey: key });
      for (const [k, list] of snapshots) {
        if (list) queryClient.setQueryData<Season[]>(k, change(list));
      }
      return snapshots;
    },
    async change<T>(key: QueryKey, change: (value: T) => T): Promise<Snapshot> {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<T>(key);
      if (previous !== undefined) queryClient.setQueryData<T>(key, change(previous));
      return [[key, previous]];
    },
    rollback(snapshots: Snapshot | undefined) {
      for (const [key, value] of snapshots ?? []) queryClient.setQueryData(key, value);
    },
    /** Seasons are computed, and linking changes goals: refetch both. */
    refresh: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: seasonKeys.all(groupId) }),
        queryClient.invalidateQueries({ queryKey: goalKeys.all(userId) }),
      ]),
  };
}

/** Group admins: create a season (shows at once). Resolves to the id. */
export function useCreateSeason() {
  const cache = useSeasonCache();
  const members = useGroupMembers(cache.groupId);
  return useMutation({
    mutationFn: async (input: CreateSeasonInput) => {
      const { data, error } = await supabase.rpc('create_season', {
        p_id: input.id,
        p_group_id: cache.groupId,
        p_name: input.name,
        p_starts_on: input.startsOn,
        p_ends_on: input.endsOn,
        ...(input.setupOpensOn ? { p_setup_opens_on: input.setupOpensOn } : {}),
        ...(input.participants ? { p_participants: input.participants } : {}),
        p_weigh_weekly: input.weighWeekly,
        // null allowed (the generated types do not know)
        p_checkin_every_weeks: input.checkinEveryWeeks as number,
        ...(input.requiredMetrics ? { p_required_metrics: input.requiredMetrics } : {}),
      });
      if (error) throw error;
      return data;
    },
    onMutate: (input) =>
      cache.changeLists((list) => [
        draftSeason(input, {
          groupId: cache.groupId,
          userId: cache.userId,
          today: goalTodayKey(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          memberIds: (members.data ?? []).map((m) => m.userId),
          defaultRequiredMetrics: DEFAULT_REQUIRED_METRICS,
        }),
        ...list.filter((s) => s.id !== input.id),
      ]),
    onError: (_error, _input, snapshots) => {
      cache.rollback(snapshots);
    },
    onSettled: cache.refresh,
  });
}

/**
 * Group admins: change a season (full new state; after the start only the name). Undo:
 * useUpdateSeason again with seasonUpdateOf(previous).
 */
export function useUpdateSeason() {
  const cache = useSeasonCache();
  return useMutation({
    mutationFn: async (input: UpdateSeasonInput) => {
      const { error } = await supabase.rpc('update_season', {
        p_season_id: input.seasonId,
        p_name: input.name,
        p_starts_on: input.startsOn,
        p_ends_on: input.endsOn,
        p_setup_opens_on: input.setupOpensOn,
        p_weigh_weekly: input.weighWeekly,
        p_checkin_every_weeks: input.checkinEveryWeeks as number,
        p_required_metrics: input.requiredMetrics,
      });
      if (error) throw error;
    },
    onMutate: (input) =>
      cache.changeLists((list) =>
        list.map((s) =>
          s.id === input.seasonId ? applySeasonUpdate(s, input, goalTodayKey()) : s,
        ),
      ),
    onError: (_error, _input, snapshots) => {
      cache.rollback(snapshots);
    },
    onSettled: cache.refresh,
  });
}

/** Group admins: cancel a season (ask first – no undo). Its goals become ordinary goals. */
export function useCancelSeason() {
  const cache = useSeasonCache();
  return useMutation({
    mutationFn: async (seasonId: string) => {
      const { error } = await supabase.rpc('cancel_season', { p_season_id: seasonId });
      if (error) throw error;
    },
    onMutate: (seasonId) => {
      const now = new Date().toISOString();
      return cache.changeLists((list) =>
        list.map((s) => {
          if (s.id !== seasonId) return s;
          const cancelled = { ...s, cancelledAt: now };
          return { ...cancelled, phase: seasonPhase(cancelled, goalTodayKey()) };
        }),
      );
    },
    onError: (_error, _input, snapshots) => {
      cache.rollback(snapshots);
    },
    onSettled: cache.refresh,
  });
}

/**
 * Group admins: add a group member to a season (after the start: a late entrant with their
 * own start; for a participant after the start: a second setup as late entrant). Undo:
 * useRemoveSeasonParticipant (right after adding nothing is lost).
 */
export function useAddSeasonParticipant() {
  const cache = useSeasonCache();
  return useMutation({
    mutationFn: async (input: AddSeasonParticipantInput) => {
      const { error } = await supabase.rpc('add_season_participant', {
        p_season_id: input.seasonId,
        p_user_id: input.userId,
        ...(input.startsOn ? { p_starts_on: input.startsOn } : {}),
      });
      if (error) throw error;
    },
    onSettled: cache.refresh,
  });
}

/** Group admins: remove a participant (ask first): their goals leave the season. */
export function useRemoveSeasonParticipant() {
  const cache = useSeasonCache();
  return useMutation({
    mutationFn: async ({ seasonId, userId }: { seasonId: string; userId: string }) => {
      const { error } = await supabase.rpc('remove_season_participant', {
        p_season_id: seasonId,
        p_user_id: userId,
      });
      if (error) throw error;
    },
    onMutate: ({ seasonId, userId }) =>
      cache.change<SeasonParticipant[]>(seasonKeys.participants(cache.groupId, seasonId), (list) =>
        list.filter((p) => p.userId !== userId),
      ),
    onError: (_error, _input, snapshots) => {
      cache.rollback(snapshots);
    },
    onSettled: cache.refresh,
  });
}

/**
 * Take one of my goals into the season (while my setup is open). The goal gets my season
 * period and becomes shared. Undo: useUnlinkSeasonGoal.
 */
export function useLinkSeasonGoal() {
  const cache = useSeasonCache();
  return useMutation({
    mutationFn: async ({
      seasonId,
      goal,
    }: {
      seasonId: string;
      goal: Pick<Goal, 'id' | 'metric'>;
    }) => {
      const { error } = await supabase.rpc('link_season_goal', {
        p_season_id: seasonId,
        p_goal_id: goal.id,
      });
      if (error) throw error;
    },
    onMutate: async ({ seasonId, goal }) => [
      ...(await cache.change<SeasonGoalLink[]>(
        seasonKeys.goalLinks(cache.groupId, seasonId),
        (links) =>
          links.some((l) => l.goalId === goal.id)
            ? links
            : [...links, { seasonId, userId: cache.userId, goalId: goal.id }],
      )),
      ...(await cache.changeLists((list) =>
        list.map((s) =>
          s.id === seasonId && s.me
            ? {
                ...s,
                me: {
                  ...s.me,
                  missingMetrics: s.me.missingMetrics.filter((m) => m !== goal.metric),
                },
              }
            : s,
        ),
      )),
    ],
    onError: (_error, _input, snapshots) => {
      cache.rollback(snapshots);
    },
    onSettled: cache.refresh,
  });
}

/** Take one of my goals out of the season (until locked). Undo: useLinkSeasonGoal. */
export function useUnlinkSeasonGoal() {
  const cache = useSeasonCache();
  return useMutation({
    mutationFn: async ({ seasonId, goalId }: { seasonId: string; goalId: string }) => {
      const { error } = await supabase.rpc('unlink_season_goal', {
        p_season_id: seasonId,
        p_goal_id: goalId,
      });
      if (error) throw error;
    },
    onMutate: ({ seasonId, goalId }) =>
      cache.change<SeasonGoalLink[]>(seasonKeys.goalLinks(cache.groupId, seasonId), (links) =>
        links.filter((l) => l.goalId !== goalId),
      ),
    onError: (_error, _input, snapshots) => {
      cache.rollback(snapshots);
    },
    onSettled: cache.refresh,
  });
}

/**
 * Mark me ready (needs a goal for every required metric) or not ready again (only before
 * the start). Once the season runs (catching up) and for a late entrant, ready locks the
 * goals at once. Undo: the opposite call (before locking).
 */
export function useSetSeasonReady() {
  const cache = useSeasonCache();
  return useMutation({
    mutationFn: async ({ seasonId, ready }: { seasonId: string; ready: boolean }) => {
      const { error } = await supabase.rpc('set_season_ready', {
        p_season_id: seasonId,
        p_ready: ready,
      });
      if (error) throw error;
    },
    onMutate: async ({ seasonId, ready }) => {
      const now = new Date().toISOString();
      let running = false;
      return [
        ...(await cache.changeLists((list) =>
          list.map((s) => {
            if (s.id !== seasonId) return s;
            running = s.phase === 'running';
            return applyReady(s, ready, now);
          }),
        )),
        ...(await cache.change<SeasonParticipant[]>(
          seasonKeys.participants(cache.groupId, seasonId),
          (list) =>
            list.map((p) =>
              p.userId === cache.userId
                ? {
                    ...p,
                    readyAt: ready ? (p.readyAt ?? now) : null,
                    locked: p.locked || (ready && (p.lateEntry || running)),
                  }
                : p,
            ),
        )),
      ];
    },
    onError: (_error, _input, snapshots) => {
      cache.rollback(snapshots);
    },
    onSettled: cache.refresh,
  });
}

/**
 * Take one of my habits into the season (while my setup is open). With the definition it
 * shows at once. Undo: useUnlinkSeasonHabit.
 */
export function useLinkSeasonHabit() {
  const cache = useSeasonCache();
  return useMutation({
    mutationFn: async ({
      seasonId,
      habitId,
    }: {
      seasonId: string;
      habitId: string;
      definition?: HabitDefinition;
    }) => {
      const { error } = await supabase.rpc('link_season_habit', {
        p_season_id: seasonId,
        p_habit_id: habitId,
      });
      if (error) throw error;
    },
    onMutate: ({ seasonId, habitId, definition }) =>
      definition
        ? cache.change<SeasonHabit[]>(
            seasonKeys.habits(cache.groupId, seasonId, goalTodayKey()),
            (list) =>
              list.some((h) => h.habitId === habitId)
                ? list
                : [
                    ...list,
                    {
                      userId: cache.userId,
                      habitId,
                      definition,
                      counted: 0,
                      met: 0,
                      quotaPct: null,
                      countUnit: definition.frequency === 'weekly' ? 'weeks' : 'days',
                      locked: false,
                      editOpenUntil: null,
                    },
                  ],
          )
        : Promise.resolve([]),
    onError: (_error, _input, snapshots) => {
      cache.rollback(snapshots);
    },
    onSettled: cache.refresh,
  });
}

/** Take one of my habits out of the season (until locked). Undo: useLinkSeasonHabit. */
export function useUnlinkSeasonHabit() {
  const cache = useSeasonCache();
  return useMutation({
    mutationFn: async ({ seasonId, habitId }: { seasonId: string; habitId: string }) => {
      const { error } = await supabase.rpc('unlink_season_habit', {
        p_season_id: seasonId,
        p_habit_id: habitId,
      });
      if (error) throw error;
    },
    onMutate: ({ seasonId, habitId }) =>
      cache.change<SeasonHabit[]>(
        seasonKeys.habits(cache.groupId, seasonId, goalTodayKey()),
        (list) => list.filter((h) => h.habitId !== habitId),
      ),
    onError: (_error, _input, snapshots) => {
      cache.rollback(snapshots);
    },
    onSettled: cache.refresh,
  });
}

/**
 * Group admins: open the fixed rule of someone's season habit for 24 hours. The person is
 * told; their next change closes it again and shows in the feed. No undo (it only allows).
 */
export function useOpenSeasonHabitEdit() {
  const cache = useSeasonCache();
  return useMutation({
    mutationFn: async ({ seasonId, habitId }: { seasonId: string; habitId: string }) => {
      const { error } = await supabase.rpc('open_season_habit_edit', {
        p_season_id: seasonId,
        p_habit_id: habitId,
      });
      if (error) throw error;
    },
    onMutate: ({ seasonId, habitId }) => {
      const until = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
      return cache.change<SeasonHabit[]>(
        seasonKeys.habits(cache.groupId, seasonId, goalTodayKey()),
        (list) => list.map((h) => (h.habitId === habitId ? { ...h, editOpenUntil: until } : h)),
      );
    },
    onError: (_error, _input, snapshots) => {
      cache.rollback(snapshots);
    },
    onSettled: cache.refresh,
  });
}

/** Refetch the season data after a habit changed elsewhere (its rule shows in the season). */
export function useRefreshSeasons() {
  return useSeasonCache().refresh;
}

/**
 * Group admins: correct the values of a locked season goal. Posts a feed card and tells
 * the owner. Undo: useCorrectSeasonGoal with correctionUndoOf(previous goal) (another
 * visible correction).
 */
export function useCorrectSeasonGoal() {
  const cache = useSeasonCache();
  return useMutation({
    mutationFn: async (input: CorrectSeasonGoalInput) => {
      const { error } = await supabase.rpc('correct_season_goal', {
        p_goal_id: input.goalId,
        // null allowed (the generated types do not know)
        p_start_value: input.startValue as number,
        p_min_value: input.minValue as number,
        p_target_value: input.targetValue,
        ...(input.validFrom ? { p_valid_from: input.validFrom } : {}),
      });
      if (error) throw error;
    },
    // Refreshes the goals too (someone else's cached lists sit under my goal keys).
    onSettled: cache.refresh,
  });
}
