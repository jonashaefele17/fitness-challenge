import { useCommentsRealtime } from '@/features/comments';
import { useFeedRealtime } from '@/features/feed';
import { useActiveGroup } from '@/features/groups';
import { useNotificationsRealtime } from '@/features/notifications';
import { useReactionsRealtime } from '@/features/reactions';

/** Live updates for the active group and my notifications while the app is open. */
export function RealtimeSync() {
  const { group } = useActiveGroup();
  useFeedRealtime(group.id);
  useCommentsRealtime(group.id);
  useReactionsRealtime(group.id);
  useNotificationsRealtime();
  return null;
}
