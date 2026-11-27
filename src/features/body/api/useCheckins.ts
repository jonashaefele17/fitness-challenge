import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUserId } from '@/features/auth';
import { supabase } from '@/shared/lib/supabase';
import { byNewestCheckin, checkinOn } from '../checkin';
import type {
  BodyCheckin,
  BodyDayMarker,
  BodyPhoto,
  CheckinStatus,
  MeasurementKind,
  MeasurementPoint,
  MeasurementStat,
  SaveCheckinInput,
} from '../types';
import { bodyKeys } from './keys';
import { schedulePhotoPurge } from './usePhotos';

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
/** The generated types do not know that computed columns may be null. */
const orNull = (v: string | null | undefined) => v ?? null;

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

/** The measurement kinds (global, in their order). Rarely changes: cached for a day. */
export function useMeasurementKinds() {
  const userId = useUserId();
  return useQuery({
    queryKey: bodyKeys.measurementKinds(userId),
    staleTime: 24 * 60 * 60_000,
    queryFn: async (): Promise<MeasurementKind[]> => {
      const { data, error } = await supabase
        .from('body_measurement_kinds')
        .select('key, label, hint, unit, step, sort, image_path, start_value')
        .order('sort');
      if (error) throw error;
      return data.map((row) => ({
        key: row.key,
        label: row.label,
        hint: row.hint,
        unit: row.unit,
        step: row.step,
        sort: row.sort,
        imagePath: row.image_path,
        startValue: row.start_value,
      }));
    },
  });
}

// ---------------------------------------------------------------------------
// Check-ins (optimistic, with rollback)
// ---------------------------------------------------------------------------

/**
 * All my check-ins with their values and live photos, newest first (skipped ones included).
 * This list is the cache of my photos, too.
 */
export function useCheckins() {
  const userId = useUserId();
  return useQuery({
    queryKey: bodyKeys.checkins(userId),
    queryFn: async (): Promise<BodyCheckin[]> => {
      const { data, error } = await supabase
        .from('body_checkins')
        .select(
          'id, on_date, skipped, created_at, updated_at, body_measurements (kind, value), body_photos (id, pose, path, thumb_path, width, height, bytes, created_at, deleted_at)',
        )
        .eq('user_id', userId)
        .is('body_photos.deleted_at', null)
        .order('on_date', { ascending: false });
      if (error) throw error;
      return data.map((row) => ({
        id: row.id,
        onDate: row.on_date,
        skipped: row.skipped,
        values: Object.fromEntries(row.body_measurements.map((m) => [m.kind, m.value])),
        photos: row.body_photos
          .filter((p) => p.deleted_at === null)
          .map((p): BodyPhoto => ({
            id: p.id,
            checkinId: row.id,
            pose: p.pose,
            path: p.path,
            thumbPath: p.thumb_path,
            width: p.width,
            height: p.height,
            bytes: p.bytes,
            createdAt: p.created_at,
          })),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    },
  });
}

/** Optimistic changes to the cached list; returns the snapshot to roll back to. */
function useCheckinCache() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  const key = bodyKeys.checkins(userId);
  return {
    async change(change: (list: BodyCheckin[]) => BodyCheckin[]) {
      await queryClient.cancelQueries({ queryKey: key });
      const snapshot = queryClient.getQueryData<BodyCheckin[]>(key);
      if (snapshot)
        queryClient.setQueryData<BodyCheckin[]>(key, change(snapshot).sort(byNewestCheckin));
      return snapshot;
    },
    rollback(snapshot: BodyCheckin[] | undefined) {
      if (snapshot) queryClient.setQueryData(key, snapshot);
    },
    /** Status, figures, history and the list are computed from the check-ins. */
    refresh: () => queryClient.invalidateQueries({ queryKey: bodyKeys.checkinsAll(userId) }),
  };
}

/** Puts a check-in into the list in place of the one with its id or on its day. */
function upsert(list: BodyCheckin[], checkin: BodyCheckin): BodyCheckin[] {
  return [...list.filter((c) => c.id !== checkin.id && c.onDate !== checkin.onDate), checkin];
}

/**
 * Save a Zwischenstand (one call, idempotent per day): creates it or updates that day's one,
 * replacing its values. Shows at once. Build the input with newCheckin(), which also gives
 * what "Rückgängig" needs: previous null → useDeleteCheckin(id); otherwise
 * useRestoreCheckin(previous). Resolves to the saved id.
 */
export function useSaveCheckin() {
  const cache = useCheckinCache();
  return useMutation({
    mutationFn: async (input: SaveCheckinInput) => {
      const { data, error } = await supabase.rpc('save_body_checkin', {
        p_on_date: input.onDate,
        p_values: input.values,
        p_id: input.id,
      });
      if (error) throw error;
      return data;
    },
    onMutate: (input) =>
      cache.change((list) => {
        const now = new Date().toISOString();
        const old = list.find((c) => c.id === input.id) ?? checkinOn(list, input.onDate);
        return upsert(list, {
          id: old?.id ?? input.id,
          onDate: input.onDate,
          skipped: false,
          values: { ...input.values },
          photos: old?.photos ?? [],
          createdAt: old?.createdAt ?? now,
          updatedAt: now,
        });
      }),
    onError: (_error, _input, snapshot) => {
      cache.rollback(snapshot);
    },
    onSettled: cache.refresh,
  });
}

/**
 * Skip the Zwischenstand of a day for this time (moves the rhythm on). Nothing happens when
 * the day already has one. id: client-generated for the new row. Undo: useDeleteCheckin(id),
 * only if the day had none before (checkinOn(list, day) === undefined).
 */
export function useSkipCheckin() {
  const cache = useCheckinCache();
  return useMutation({
    mutationFn: async (input: { id: string; onDate: string }) => {
      const { data, error } = await supabase.rpc('skip_body_checkin', {
        p_on_date: input.onDate,
        p_id: input.id,
      });
      if (error) throw error;
      return data;
    },
    onMutate: (input) =>
      cache.change((list) => {
        if (checkinOn(list, input.onDate)) return list;
        const now = new Date().toISOString();
        return [
          ...list,
          {
            id: input.id,
            onDate: input.onDate,
            skipped: true,
            values: {},
            photos: [],
            createdAt: now,
            updatedAt: now,
          },
        ];
      }),
    onError: (_error, _input, snapshot) => {
      cache.rollback(snapshot);
    },
    onSettled: cache.refresh,
  });
}

/**
 * Delete a check-in with its values and photos. Undo: useRestoreCheckin with the deleted
 * BodyCheckin (brings the photos back, too). Without undo the photo files are purged once
 * the grace period has passed.
 */
export function useDeleteCheckin() {
  const cache = useCheckinCache();
  return useMutation({
    mutationFn: async (checkinId: string) => {
      const { error } = await supabase.from('body_checkins').delete().eq('id', checkinId);
      if (error) throw error;
    },
    onMutate: (checkinId) => cache.change((list) => list.filter((c) => c.id !== checkinId)),
    onSuccess: () => {
      schedulePhotoPurge();
    },
    onError: (_error, _input, snapshot) => {
      cache.rollback(snapshot);
    },
    onSettled: cache.refresh,
  });
}

/**
 * Undo: puts a check-in back as it was (same id, day, values, exactly its photos; a skipped
 * one as skipped), after a delete or in place of a later save of that day. Photos added
 * since are deleted (and purged later); photos purged meanwhile cannot come back.
 */
export function useRestoreCheckin() {
  const cache = useCheckinCache();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (checkin: BodyCheckin) => {
      if (checkin.skipped) {
        // A skip never overwrites a check-in: clear the day first.
        const { error: deleteError } = await supabase
          .from('body_checkins')
          .delete()
          .eq('user_id', userId)
          .eq('on_date', checkin.onDate);
        if (deleteError) throw deleteError;
        const { error } = await supabase.rpc('skip_body_checkin', {
          p_on_date: checkin.onDate,
          p_id: checkin.id,
        });
        if (error) throw error;
        return;
      }
      const { error } = await supabase.rpc('save_body_checkin', {
        p_on_date: checkin.onDate,
        p_values: checkin.values,
        p_id: checkin.id,
      });
      if (error) throw error;
      const { error: photosError } = await supabase.rpc('set_body_checkin_photos', {
        p_checkin_id: checkin.id,
        p_photo_ids: checkin.photos.map((p) => p.id),
      });
      if (photosError) throw photosError;
    },
    onMutate: (checkin) => cache.change((list) => upsert(list, checkin)),
    onSuccess: () => {
      schedulePhotoPurge();
    },
    onError: (_error, _input, snapshot) => {
      cache.rollback(snapshot);
    },
    onSettled: cache.refresh,
  });
}

// ---------------------------------------------------------------------------
// Computed (body_checkin_status, body_measurement_stats, body_measurement_history)
// ---------------------------------------------------------------------------

/** Where my rhythm stands on a local day (today: todayKey()). */
export function useCheckinStatus(today: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: bodyKeys.checkinStatus(userId, today),
    queryFn: async (): Promise<CheckinStatus> => {
      const { data, error } = await supabase.rpc('body_checkin_status', {
        p_user_id: userId,
        p_today: today,
      });
      if (error) throw error;
      const row = data[0];
      return {
        lastOn: row?.last_on ?? null,
        lastDoneOn: row?.last_done_on ?? null,
        everyWeeks: row?.every_weeks ?? null,
        nextDueOn: row?.next_due_on ?? null,
        due: row?.due ?? false,
        daysUntil: row?.days_until ?? null,
      };
    },
  });
}

/**
 * My special days in a range for the calendar and Heute: each weigh day and the day my
 * next Zwischenstand is due (computed in the database from my own rhythms; only mine).
 */
export function useBodyDayMarkers(from: string, to: string, today: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: bodyKeys.dayMarkers(userId, from, to, today),
    queryFn: async (): Promise<BodyDayMarker[]> => {
      const { data, error } = await supabase.rpc('body_day_markers', {
        p_from: from,
        p_to: to,
        p_today: today,
      });
      if (error) throw error;
      return data.map((row) => ({
        onDate: row.on_date,
        kind: row.kind === 'checkin_due' ? 'checkin_due' : 'weigh_day',
      }));
    },
  });
}

/** Per kind I have values for (hidden ones too), in catalogue order. */
export function useMeasurementStats() {
  const userId = useUserId();
  return useQuery({
    queryKey: bodyKeys.measurementStats(userId),
    queryFn: async (): Promise<MeasurementStat[]> => {
      const { data, error } = await supabase.rpc('body_measurement_stats', {
        p_user_id: userId,
      });
      if (error) throw error;
      return data.map((row) => ({
        kind: row.kind,
        latestValue: row.latest_value,
        latestOn: row.latest_on,
        previousValue: num(row.previous_value),
        previousOn: orNull(row.previous_on),
        firstValue: row.first_value,
        firstOn: row.first_on,
        changeSincePrevious: num(row.change_since_previous),
        changeSinceFirst: num(row.change_since_first),
        valueCount: row.value_count,
      }));
    },
  });
}

/** All my values of a kind, oldest first (null kind: disabled). */
export function useMeasurementHistory(kind: string | null) {
  const userId = useUserId();
  return useQuery({
    queryKey: bodyKeys.measurementHistory(userId, kind ?? ''),
    enabled: kind !== null,
    queryFn: async (): Promise<MeasurementPoint[]> => {
      const { data, error } = await supabase.rpc('body_measurement_history', {
        p_user_id: userId,
        p_kind: kind ?? '',
      });
      if (error) throw error;
      return data.map((row) => ({
        onDate: row.on_date,
        value: row.value,
        checkinId: row.checkin_id,
      }));
    },
  });
}
