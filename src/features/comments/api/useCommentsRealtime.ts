import { useRealtimeInvalidation } from '@/shared/lib/realtime';
import { commentKeys } from './useComments';

/** New, edited and deleted comments update threads and speech bubbles live. */
export function useCommentsRealtime(groupId: string) {
  useRealtimeInvalidation({
    channel: `comments:${groupId}`,
    table: 'comments',
    events: ['INSERT', 'UPDATE'],
    filter: `group_id=eq.${groupId}`,
    queryKey: commentKeys.all(groupId),
  });
}
