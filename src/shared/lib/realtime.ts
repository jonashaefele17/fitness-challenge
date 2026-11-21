import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useEffect } from 'react';
import { REALTIME_SUBSCRIBE_STATES, supabase } from './supabase';

type ChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE';

export interface RealtimeInvalidation {
  /** Unique channel name, e.g. "comments:<groupId>". */
  channel: string;
  table: string;
  events: ChangeEvent[];
  /** Server-side filter for INSERT/UPDATE, e.g. "group_id=eq.<id>". DELETE is never filtered. */
  filter?: string;
  /** Queries to refresh when something changed. */
  queryKey: QueryKey;
  enabled?: boolean;
}

/**
 * Subscribes to row changes of a table and refreshes the given queries. Data itself is
 * always re-read through the normal queries (and RLS); the event is only a signal.
 * After (re)connecting, the queries are refreshed too, so changes missed while the app
 * was in the background (or while the subscription was starting) are picked up.
 */
export function useRealtimeInvalidation({
  channel,
  table,
  events,
  filter,
  queryKey,
  enabled = true,
}: RealtimeInvalidation) {
  const queryClient = useQueryClient();
  const keyHash = JSON.stringify(queryKey);
  const eventList = events.join(',');

  useEffect(() => {
    if (!enabled) return;
    const key = JSON.parse(keyHash) as QueryKey;
    const invalidate = () => void queryClient.invalidateQueries({ queryKey: key });

    let subscription = supabase.channel(channel);
    for (const event of eventList.split(',') as ChangeEvent[]) {
      subscription = subscription.on(
        'postgres_changes',
        {
          event,
          schema: 'public',
          table,
          ...(filter && event !== 'DELETE' && { filter }),
        },
        invalidate,
      );
    }
    // "Subscribed to PostgreSQL" arrives a moment after SUBSCRIBED; changes in between are
    // not streamed, so refresh again once the database side is ready.
    subscription = subscription.on('system', {}, (payload: { status?: string }) => {
      if (payload.status === 'ok') invalidate();
    });
    subscription.subscribe((status) => {
      if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) invalidate();
    });

    return () => {
      void supabase.removeChannel(subscription);
    };
  }, [enabled, channel, table, eventList, filter, keyHash, queryClient]);
}
