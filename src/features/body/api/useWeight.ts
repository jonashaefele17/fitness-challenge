import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useUserId } from '@/features/auth';
import { supabase } from '@/shared/lib/supabase';
import { weightWeek, weightWeekRange } from '../progress';
import { bodyKeys } from './keys';
import type {
  BodySettings,
  Scale,
  ScaleOffsetSuggestion,
  WeighIn,
  WeightDay,
  WeightProgressDay,
  WeightShare,
  WeightShareView,
  WeightSummary,
} from '../types';

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

function useRefresh() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return () => queryClient.invalidateQueries({ queryKey: bodyKeys.all(userId) });
}

// ---------------------------------------------------------------------------
// Scales
// ---------------------------------------------------------------------------

/** My scales (also archived ones), the main scale first. */
export function useScales() {
  const userId = useUserId();
  return useQuery({
    queryKey: bodyKeys.scales(userId),
    queryFn: async (): Promise<Scale[]> => {
      const { data, error } = await supabase
        .from('scales')
        .select('id, name, is_main, offset_kg, archived_at, created_at')
        .eq('user_id', userId)
        .order('is_main', { ascending: false })
        .order('created_at');
      if (error) throw error;
      return data.map((row) => ({
        id: row.id,
        name: row.name,
        isMain: row.is_main,
        offsetKg: row.offset_kg,
        archived: row.archived_at !== null,
        createdAt: row.created_at,
      }));
    },
  });
}

/** A new scale; the first one becomes the main scale by itself. Returns its id. */
export function useCreateScale() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (input: { name: string; offsetKg?: number }) => {
      const id = crypto.randomUUID();
      const { error } = await supabase
        .from('scales')
        .insert({ id, name: input.name.trim(), offset_kg: input.offsetKg ?? 0 });
      if (error) throw error;
      return id;
    },
    onSettled: refresh,
  });
}

/** Rename a scale and/or set its offset by hand (not for the main scale: it is always 0). */
export function useUpdateScale() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (input: { scaleId: string; name?: string; offsetKg?: number }) => {
      const patch: { name?: string; offset_kg?: number } = {};
      if (input.name !== undefined) patch.name = input.name.trim();
      if (input.offsetKg !== undefined) patch.offset_kg = input.offsetKg;
      const { error } = await supabase.from('scales').update(patch).eq('id', input.scaleId);
      if (error) throw error;
    },
    onSettled: refresh,
  });
}

/** Make a scale the main one; all offsets are re-based in the database. */
export function useSetMainScale() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (scaleId: string) => {
      const { error } = await supabase.rpc('set_main_scale', { p_scale_id: scaleId });
      if (error) throw error;
    },
    onSettled: refresh,
  });
}

/**
 * Archive a scale (its entries stay) or bring it back (archive: false, also the undo).
 * The main scale can only be archived when no other scale is in use: the database refuses
 * with "main_scale_in_use".
 */
export function useArchiveScale() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (input: { scaleId: string; archive: boolean }) => {
      const { error } = await supabase
        .from('scales')
        .update({ archived_at: input.archive ? new Date().toISOString() : null })
        .eq('id', input.scaleId);
      if (error) throw error;
    },
    onSettled: refresh,
  });
}

/** For a non-main scale: the offset the days on both scales suggest (null: none). */
export function useScaleOffsetSuggestion(scaleId: string | null) {
  const userId = useUserId();
  return useQuery({
    queryKey: bodyKeys.suggestion(userId, scaleId ?? ''),
    enabled: scaleId !== null,
    queryFn: async (): Promise<ScaleOffsetSuggestion | null> => {
      const { data, error } = await supabase.rpc('scale_offset_suggestion', {
        p_scale_id: scaleId ?? '',
      });
      if (error) throw error;
      const row = data[0];
      return row
        ? {
            scaleId: row.scale_id,
            suggestedOffsetKg: num(row.suggested_offset_kg),
            commonDays: row.common_days,
          }
        : null;
    },
  });
}

// ---------------------------------------------------------------------------
// Weigh-ins (optimistic, with rollback)
// ---------------------------------------------------------------------------

function toWeighIn(row: {
  id: string;
  scale_id: string | null;
  measured_on: string;
  measured_at: string;
  weight_kg: number;
  source: string;
}): WeighIn {
  return {
    id: row.id,
    scaleId: row.scale_id,
    measuredOn: row.measured_on,
    measuredAt: row.measured_at,
    weightKg: row.weight_kg,
    source: row.source === 'external' ? 'external' : 'manual',
  };
}

/** Newest first: by day, then by time. */
function byNewest(a: WeighIn, b: WeighIn): number {
  return b.measuredOn.localeCompare(a.measuredOn) || b.measuredAt.localeCompare(a.measuredAt);
}

/** My weigh-ins in a range (from null: all), newest first. */
export function useWeighIns(from: string | null, to: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: bodyKeys.weighIns(userId, from, to),
    queryFn: async (): Promise<WeighIn[]> => {
      let query = supabase
        .from('weigh_ins')
        .select('id, scale_id, measured_on, measured_at, weight_kg, source')
        .eq('user_id', userId)
        .lte('measured_on', to);
      if (from !== null) query = query.gte('measured_on', from);
      const { data, error } = await query
        .order('measured_on', { ascending: false })
        .order('measured_at', { ascending: false });
      if (error) throw error;
      return data.map(toWeighIn);
    },
  });
}

/**
 * Optimistic changes to every cached weigh-in list: `change` gets each list and its range
 * and returns the new list. Returns the snapshot to roll back to.
 */
function useWeighInCache() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  const prefix = bodyKeys.weighInsAll(userId);
  return {
    async change(
      change: (list: WeighIn[], inRange: (day: string) => boolean) => WeighIn[],
    ): Promise<[QueryKey, WeighIn[] | undefined][]> {
      await queryClient.cancelQueries({ queryKey: prefix });
      const snapshot = queryClient.getQueriesData<WeighIn[]>({ queryKey: prefix });
      for (const [key, list] of snapshot) {
        if (!list) continue;
        const from = key[prefix.length] as string | null;
        const to = key[prefix.length + 1] as string;
        const inRange = (day: string) => (from === null || day >= from) && day <= to;
        queryClient.setQueryData<WeighIn[]>(key, change(list, inRange).sort(byNewest));
      }
      return snapshot;
    },
    rollback(snapshot: [QueryKey, WeighIn[] | undefined][] | undefined) {
      for (const [key, list] of snapshot ?? []) queryClient.setQueryData(key, list);
    },
  };
}

export interface NewWeighIn {
  /** null: no scale (counts as the main scale). */
  scaleId: string | null;
  /** Local day, "2026-12-01". */
  measuredOn: string;
  weightKg: number;
  /** ISO timestamp; default now. */
  measuredAt?: string;
}

/** Add a weigh-in; shows at once, saved in the background. Returns its id. */
export function useAddWeighIn() {
  const cache = useWeighInCache();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (input: NewWeighIn & { id: string; measuredAt: string }) => {
      const { error } = await supabase.from('weigh_ins').insert({
        id: input.id,
        scale_id: input.scaleId,
        measured_on: input.measuredOn,
        measured_at: input.measuredAt,
        weight_kg: input.weightKg,
      });
      if (error) throw error;
      return input.id;
    },
    onMutate: (input) =>
      cache.change((list, inRange) =>
        inRange(input.measuredOn)
          ? [
              ...list,
              {
                id: input.id,
                scaleId: input.scaleId,
                measuredOn: input.measuredOn,
                measuredAt: input.measuredAt,
                weightKg: input.weightKg,
                source: 'manual',
              },
            ]
          : list,
      ),
    onError: (_error, _input, snapshot) => {
      cache.rollback(snapshot);
    },
    onSettled: refresh,
  });
}

/**
 * The input for useAddWeighIn().mutate with its id and time filled in, so the caller
 * knows the id at once (e.g. to offer "Rückgängig" by deleting it).
 */
export function newWeighIn(input: NewWeighIn): NewWeighIn & { id: string; measuredAt: string } {
  return {
    ...input,
    id: crypto.randomUUID(),
    measuredAt: input.measuredAt ?? new Date().toISOString(),
  };
}

/**
 * Change a weigh-in. Undo: call it again with the old values (the WeighIn the UI showed).
 */
export function useUpdateWeighIn() {
  const cache = useWeighInCache();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      scaleId?: string | null;
      measuredOn?: string;
      measuredAt?: string;
      weightKg?: number;
    }) => {
      const patch: {
        scale_id?: string | null;
        measured_on?: string;
        measured_at?: string;
        weight_kg?: number;
      } = {};
      if (input.scaleId !== undefined) patch.scale_id = input.scaleId;
      if (input.measuredOn !== undefined) patch.measured_on = input.measuredOn;
      if (input.measuredAt !== undefined) patch.measured_at = input.measuredAt;
      if (input.weightKg !== undefined) patch.weight_kg = input.weightKg;
      const { error } = await supabase.from('weigh_ins').update(patch).eq('id', input.id);
      if (error) throw error;
    },
    onMutate: (input) =>
      cache.change((list, inRange) => {
        const old = list.find((w) => w.id === input.id);
        if (!old) return list;
        const updated: WeighIn = {
          ...old,
          ...(input.scaleId !== undefined && { scaleId: input.scaleId }),
          ...(input.measuredOn !== undefined && { measuredOn: input.measuredOn }),
          ...(input.measuredAt !== undefined && { measuredAt: input.measuredAt }),
          ...(input.weightKg !== undefined && { weightKg: input.weightKg }),
        };
        const rest = list.filter((w) => w.id !== input.id);
        return inRange(updated.measuredOn) ? [...rest, updated] : rest;
      }),
    onError: (_error, _input, snapshot) => {
      cache.rollback(snapshot);
    },
    onSettled: refresh,
  });
}

/** Delete a weigh-in. Undo with useRestoreWeighIn and the deleted WeighIn. */
export function useDeleteWeighIn() {
  const cache = useWeighInCache();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (weighInId: string) => {
      const { error } = await supabase.from('weigh_ins').delete().eq('id', weighInId);
      if (error) throw error;
    },
    onMutate: (weighInId) => cache.change((list) => list.filter((w) => w.id !== weighInId)),
    onError: (_error, _input, snapshot) => {
      cache.rollback(snapshot);
    },
    onSettled: refresh,
  });
}

/** Undo of a delete: puts the same entry back (same id, day, time, scale, value). */
export function useRestoreWeighIn() {
  const cache = useWeighInCache();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (weighIn: WeighIn) => {
      const { error } = await supabase.from('weigh_ins').insert({
        id: weighIn.id,
        scale_id: weighIn.scaleId,
        measured_on: weighIn.measuredOn,
        measured_at: weighIn.measuredAt,
        weight_kg: weighIn.weightKg,
        source: weighIn.source,
      });
      if (error) throw error;
    },
    onMutate: (weighIn) =>
      cache.change((list, inRange) =>
        inRange(weighIn.measuredOn) && !list.some((w) => w.id === weighIn.id)
          ? [...list, weighIn]
          : list,
      ),
    onError: (_error, _input, snapshot) => {
      cache.rollback(snapshot);
    },
    onSettled: refresh,
  });
}

// ---------------------------------------------------------------------------
// Computed figures (weight_days, weight_summary)
// ---------------------------------------------------------------------------

/** Days with entries in a range (from null: all), with the 7-day trend. Oldest first. */
export function useWeightDays(from: string | null, to: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: bodyKeys.days(userId, from, to),
    queryFn: async (): Promise<WeightDay[]> => {
      const { data, error } = await supabase.rpc('weight_days', {
        p_user_id: userId,
        // null: from the first entry (the generated types do not know it may be null)
        p_from: from as string,
        p_to: to,
      });
      if (error) throw error;
      return data.map((row) => ({
        onDate: row.on_date,
        weightKg: row.weight_kg,
        entries: row.entries,
        trendKg: row.trend_kg,
      }));
    },
  });
}

/**
 * Current value, change in kg and %, latest entry of a range (from null: all). With a
 * personId: someone else's, masked by the database to what they share (`share`).
 */
export function useWeightSummary(from: string | null, to: string, personId?: string) {
  const userId = useUserId();
  const person = personId ?? userId;
  return useQuery({
    queryKey: bodyKeys.summary(userId, from, to, person),
    queryFn: async (): Promise<WeightSummary> => {
      const { data, error } = await supabase.rpc('weight_summary', {
        p_user_id: person,
        p_from: from as string,
        p_to: to,
      });
      if (error) throw error;
      const row = data[0];
      return {
        currentTrendKg: num(row?.current_trend_kg),
        currentOn: row?.current_on ?? null,
        startTrendKg: num(row?.start_trend_kg),
        startOn: row?.start_on ?? null,
        changeKg: num(row?.change_kg),
        changePct: num(row?.change_pct),
        latestKg: num(row?.latest_kg),
        latestAdjustedKg: num(row?.latest_adjusted_kg),
        latestScaleId: row?.latest_scale_id ?? null,
        latestOn: row?.latest_on ?? null,
        daysWithEntries: row?.days_with_entries ?? 0,
        share: toShareView(row?.share),
      };
    },
  });
}

function toShareView(value: string | null | undefined): WeightShareView | null {
  return value === 'own' || value === 'days' || value === 'kg' || value === 'percent'
    ? value
    : null;
}

/**
 * Query options of someone's curve (useWeightProgress), for several people at once with
 * useQueries. userId: the signed-in user (part of the key).
 */
export function weightProgressOptions(
  userId: string,
  person: string,
  from: string | null,
  to: string,
) {
  return {
    queryKey: bodyKeys.progress(userId, person, from, to),
    queryFn: async (): Promise<WeightProgressDay[]> => {
      const { data, error } = await supabase.rpc('weight_progress', {
        p_user_id: person,
        p_from: from as string,
        p_to: to,
      });
      if (error) throw error;
      return data.map((row) => ({
        onDate: row.on_date,
        changePct: row.change_pct,
        trendKg: num(row.trend_kg),
        weightKg: num(row.weight_kg),
      }));
    },
  };
}

/**
 * The curve of a range (from null: from the first entry): per day with entries the change
 * of the 7-day trend in % against the first day, and the trend in kg when it is mine or
 * shared in kg. Others who do not share: an empty list. Oldest first.
 */
export function useWeightProgress(from: string | null, to: string, personId?: string) {
  const userId = useUserId();
  return useQuery(weightProgressOptions(userId, personId ?? userId, from, to));
}

/**
 * Someone's week for the feed card: change this week and over the 4 weeks ending with it
 * (weekStart: Monday). null: nothing in that week, or not (any longer) shared.
 */
export function useWeightWeek(weekStart: string, personId?: string) {
  const userId = useUserId();
  const range = weightWeekRange(weekStart);
  return useQuery({
    ...weightProgressOptions(userId, personId ?? userId, range.from, range.to),
    select: (days: WeightProgressDay[]) => weightWeek(days, weekStart),
  });
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS: BodySettings = {
  weighReminderDays: [],
  weighReminderAt: null,
  weightShare: 'private',
  checkinEveryWeeks: null,
  checkinReminderAt: null,
  hiddenMeasurementKinds: [],
};

function toWeightShare(value: string | null | undefined): WeightShare {
  return value === 'percent' || value === 'kg' || value === 'days' ? value : 'private';
}

/**
 * My weigh-in reminder, who sees my weight, the Zwischenstand rhythm and the measurements I
 * leave out (no row yet: no reminder, private, no rhythm, nothing hidden).
 */
export function useBodySettings() {
  const userId = useUserId();
  return useQuery({
    queryKey: bodyKeys.settings(userId),
    queryFn: async (): Promise<BodySettings> => {
      const { data, error } = await supabase
        .from('body_settings')
        .select(
          'weigh_reminder_days, weigh_reminder_at, weight_share, checkin_every_weeks, checkin_reminder_at, hidden_measurement_kinds',
        )
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return {
        weighReminderDays: data?.weigh_reminder_days ?? [],
        weighReminderAt: data?.weigh_reminder_at ? data.weigh_reminder_at.slice(0, 5) : null,
        weightShare: toWeightShare(data?.weight_share),
        checkinEveryWeeks: data?.checkin_every_weeks ?? null,
        checkinReminderAt: data?.checkin_reminder_at ? data.checkin_reminder_at.slice(0, 5) : null,
        hiddenMeasurementKinds: data?.hidden_measurement_kinds ?? [],
      };
    },
  });
}

/**
 * Save settings; only the fields given change, shows at once. Choosing days and a time (or a
 * check-in rhythm and a time) for the first time switches the "Körper" push category on.
 * Undo: save the old values again.
 */
export function useSaveBodySettings() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (settings: Partial<BodySettings>) => {
      const { error } = await supabase.from('body_settings').upsert({
        user_id: userId,
        ...(settings.weighReminderDays !== undefined && {
          weigh_reminder_days: [...new Set(settings.weighReminderDays)].sort((a, b) => a - b),
        }),
        ...(settings.weighReminderAt !== undefined && {
          weigh_reminder_at: settings.weighReminderAt,
        }),
        ...(settings.weightShare !== undefined && { weight_share: settings.weightShare }),
        ...(settings.checkinEveryWeeks !== undefined && {
          checkin_every_weeks: settings.checkinEveryWeeks,
        }),
        ...(settings.checkinReminderAt !== undefined && {
          checkin_reminder_at: settings.checkinReminderAt,
        }),
        ...(settings.hiddenMeasurementKinds !== undefined && {
          hidden_measurement_kinds: [...new Set(settings.hiddenMeasurementKinds)],
        }),
      });
      if (error) throw error;
    },
    onMutate: async (settings) => {
      const key = bodyKeys.settings(userId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<BodySettings>(key);
      queryClient.setQueryData<BodySettings>(key, {
        ...(previous ?? DEFAULT_SETTINGS),
        ...settings,
      });
      return previous;
    },
    onError: (_error, _settings, previous) => {
      queryClient.setQueryData(bodyKeys.settings(userId), previous);
    },
    onSettled: async (_data, _error, settings) => {
      await queryClient.invalidateQueries({ queryKey: bodyKeys.settings(userId) });
      // The rhythm decides when the Zwischenstand is due.
      if (settings.checkinEveryWeeks !== undefined) {
        await queryClient.invalidateQueries({ queryKey: bodyKeys.checkinsAll(userId) });
      }
    },
  });
}
