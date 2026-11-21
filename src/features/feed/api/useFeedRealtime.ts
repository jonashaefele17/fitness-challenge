import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';
import { REALTIME_SUBSCRIBE_STATES, supabase } from '@/shared/lib/supabase';
import { feedKeys } from './useFeed';

// Groups with posts that arrived after the feed was loaded. The list does not jump: it
// shows "↑ Neue Beiträge" and refreshes when tapped (or right away when at the top).
const pending = new Set<string>();
const listeners = new Set<() => void>();
const emit = () => {
  for (const listener of listeners) listener();
};

export function markFeedSeen(groupId: string) {
  if (pending.delete(groupId)) emit();
}

export function useNewPosts(groupId: string): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => pending.has(groupId),
  );
}

/** New posts are announced (not inserted) while the app is open; "who trained today" updates. */
export function useFeedRealtime(groupId: string) {
  const queryClient = useQueryClient();
  useEffect(() => {
    const announce = () => {
      void queryClient.invalidateQueries({ queryKey: feedKeys.today(groupId) });
      pending.add(groupId);
      emit();
    };
    const channel = supabase
      .channel(`feed:${groupId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'feed_events',
          filter: `group_id=eq.${groupId}`,
        },
        announce,
      )
      .subscribe((status) => {
        // After (re)connecting, anything missed in the background is announced too.
        if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
          void queryClient.invalidateQueries({ queryKey: feedKeys.today(groupId) });
        }
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [groupId, queryClient]);
}
