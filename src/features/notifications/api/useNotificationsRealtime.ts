import { useUserId } from '@/features/auth';
import { useRealtimeInvalidation } from '@/shared/lib/realtime';
import { notificationKeys } from './useNotifications';

/** The bell updates the moment something concerns me. */
export function useNotificationsRealtime() {
  const userId = useUserId();
  useRealtimeInvalidation({
    channel: `notifications:${userId}`,
    table: 'notifications',
    events: ['INSERT', 'UPDATE'],
    filter: `recipient_id=eq.${userId}`,
    queryKey: notificationKeys.all(userId),
  });
}
