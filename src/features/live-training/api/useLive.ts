import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { useUserId } from '@/features/auth';
import { trainingKeys, type ActiveWorkout } from '@/features/training';
import { REALTIME_SUBSCRIBE_STATES, supabase } from '@/shared/lib/supabase';
import type { LiveToday, PeerSets } from '../types';

/**
 * Changes arrive through the session's channel (useLiveChannel); re-reading now and then
 * only catches what was missed (app in the background, connection lost).
 */
const POLL_MS = 30_000;

export const liveKeys = {
  all: (userId: string) => ['live', userId] as const,
  session: (userId: string, workoutId: string) =>
    [...liveKeys.all(userId), 'session', workoutId] as const,
  peers: (userId: string, workoutId: string) =>
    [...liveKeys.all(userId), 'peers', workoutId] as const,
  order: (userId: string, workoutId: string) =>
    [...liveKeys.all(userId), 'order', workoutId] as const,
  today: (userId: string, day: string) => [...liveKeys.all(userId), 'today', day] as const,
  along: (userId: string, workoutIds: string[]) =>
    [...liveKeys.all(userId), 'along', workoutIds] as const,
};

/** The session a running workout takes part in: who trains along (still training or done). */
export function useLiveSession(workoutId: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: liveKeys.session(userId, workoutId),
    refetchInterval: POLL_MS,
    queryFn: async () => {
      const { data: me, error } = await supabase
        .from('live_members')
        .select('session_id')
        .eq('workout_id', workoutId)
        .maybeSingle();
      if (error) throw error;
      if (!me) return null;
      const { data, error: membersError } = await supabase
        .from('live_members')
        .select('user_id, workouts!inner(status)')
        .eq('session_id', me.session_id)
        .order('joined_at');
      if (membersError) throw membersError;
      return {
        sessionId: me.session_id,
        others: data
          .filter((m) => m.user_id !== userId)
          .map((m) => ({ userId: m.user_id, training: m.workouts.status === 'active' })),
      };
    },
  });
}

/**
 * Listens to the session's private channel: every change to a workout in it re-reads the
 * session (my list, the others' sets). Also re-reads after (re)connecting.
 */
export function useLiveChannel(sessionId: string | null) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!sessionId) return;
    const refresh = () => void queryClient.invalidateQueries({ queryKey: liveKeys.all(userId) });
    const channel = supabase
      .channel(`live:${sessionId}`, { config: { private: true } })
      .on('broadcast', { event: 'changed' }, refresh)
      .subscribe((status) => {
        if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) refresh();
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionId, userId, queryClient]);
}

/** Slot: whether a workout is trained together. */
export function useIsLive(workoutId: string): boolean {
  return Boolean(useLiveSession(workoutId).data);
}

/** Slot: keep the next exercise personal. */
export function useKeepPrivate() {
  return useCallback(async (itemId: string) => {
    const { error } = await supabase.rpc('live_keep_private', { p_item_id: itemId });
    if (error) throw error;
  }, []);
}

/**
 * Exercises the others added, removed or moved reach my workout: when the saved order
 * differs from what I see (and I am not saving anything myself), my workout is re-read.
 */
export function useLiveSync(workoutId: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const saved = useQuery({
    queryKey: liveKeys.order(userId, workoutId),
    refetchInterval: POLL_MS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_items')
        .select('id')
        .eq('workout_id', workoutId)
        .order('position');
      if (error) throw error;
      return data.map((row) => row.id).join(',');
    },
  }).data;

  useEffect(() => {
    if (saved === undefined || queryClient.isMutating() > 0) return;
    const shown = queryClient.getQueryData<ActiveWorkout | null>(trainingKeys.active(userId));
    if (shown?.id !== workoutId) return;
    if (shown.items.map((item) => item.id).join(',') !== saved) {
      void queryClient.invalidateQueries({ queryKey: trainingKeys.active(userId) });
    }
  }, [saved, queryClient, userId, workoutId]);
}

/** The others' done sets per shared exercise of my workout. */
export function usePeerSets(workoutId: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: liveKeys.peers(userId, workoutId),
    refetchInterval: POLL_MS,
    queryFn: async (): Promise<PeerSets[]> => {
      const { data, error } = await supabase.rpc('live_peer_sets', { p_workout_id: workoutId });
      if (error) throw error;
      return data.map((row) => ({
        itemId: row.item_id,
        userId: row.user_id,
        sets: row.sets as PeerSets['sets'],
      }));
    },
  });
}

/** Today's plan dates of others I take part in (to start or join). */
export function useLiveToday(day: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: liveKeys.today(userId, day),
    refetchInterval: 30_000,
    queryFn: async (): Promise<LiveToday[]> => {
      const { data, error } = await supabase.rpc('live_today', { p_today: day });
      if (error) throw error;
      return data.map((row) => ({
        planId: row.plan_id,
        planOn: row.plan_on,
        ownerId: row.owner_id,
        startTime: (row.start_time as string | null) ? row.start_time.slice(0, 5) : null,
        typeName: row.type_name,
        typeIcon: row.type_icon,
        focusName: row.focus_name,
        running: (row.session_id as string | null) !== null && row.member_ids.length > 0,
        memberIds: row.member_ids,
        myWorkoutId: (row.my_workout_id as string | null) ?? null,
      }));
    },
  });
}

/** Start or join someone else's plan date with my own workout. */
export function useLiveStart() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { planId: string; planOn: string }) => {
      const { error } = await supabase.rpc('live_start', {
        p_plan_id: input.planId,
        p_plan_on: input.planOn,
      });
      if (error) throw error;
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: trainingKeys.active(userId) }),
        queryClient.invalidateQueries({ queryKey: liveKeys.all(userId) }),
      ]),
  });
}

/** Who trained along in finished workouts (for "mit …" in the feed). */
export function useTrainedAlong(workoutIds: string[]) {
  const userId = useUserId();
  const ids = [...new Set(workoutIds)].sort();
  return useQuery({
    queryKey: liveKeys.along(userId, ids),
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Map<string, string[]>> => {
      const { data: mine, error } = await supabase
        .from('live_members')
        .select('session_id, workout_id')
        .in('workout_id', ids);
      if (error) throw error;
      const sessions = [...new Set(mine.map((m) => m.session_id))];
      if (sessions.length === 0) return new Map();
      const { data: all, error: allError } = await supabase
        .from('live_members')
        .select('session_id, user_id, workout_id')
        .in('session_id', sessions);
      if (allError) throw allError;
      return new Map(
        mine.map((m) => {
          const own = all.find((a) => a.workout_id === m.workout_id)?.user_id;
          return [
            m.workout_id,
            all
              .filter((a) => a.session_id === m.session_id && a.user_id !== own)
              .map((a) => a.user_id),
          ];
        }),
      );
    },
  });
}
