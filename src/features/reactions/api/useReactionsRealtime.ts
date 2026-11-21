import { groupKeys } from '@/features/groups';
import { useRealtimeInvalidation } from '@/shared/lib/realtime';

/** Reactions of others appear live (removals arrive unfiltered, they only carry the id). */
export function useReactionsRealtime(groupId: string) {
  useRealtimeInvalidation({
    channel: `reactions:${groupId}`,
    table: 'reactions',
    events: ['INSERT', 'UPDATE', 'DELETE'],
    filter: `group_id=eq.${groupId}`,
    queryKey: [...groupKeys.scope(groupId), 'reactions'],
  });
}
