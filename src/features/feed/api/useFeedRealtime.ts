import { useRealtimeInvalidation } from '@/shared/lib/realtime';
import { feedKeys } from './useFeed';

/** New feed cards appear without reloading. */
export function useFeedRealtime(groupId: string) {
  useRealtimeInvalidation({
    channel: `feed:${groupId}`,
    table: 'feed_events',
    events: ['INSERT'],
    filter: `group_id=eq.${groupId}`,
    queryKey: feedKeys.list(groupId),
  });
}
