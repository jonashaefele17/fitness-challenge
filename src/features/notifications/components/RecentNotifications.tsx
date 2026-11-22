import type { TargetRef } from '@/shared/types/target';
import { useMarkNotificationRead, useNotifications } from '../api/useNotifications';
import { NotificationItem, type OpenTargetOptions } from './NotificationBell';

/** "Neu für dich": the latest unread notifications (nothing when all is read). */
export function RecentNotifications({
  limit = 3,
  onOpenTarget,
  onShowAll,
}: {
  limit?: number;
  onOpenTarget: (target: TargetRef, options: OpenTargetOptions) => void;
  onShowAll: () => void;
}) {
  const unread = (useNotifications().data ?? []).filter((n) => n.readAt === null);
  const markRead = useMarkNotificationRead();
  if (unread.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-footnote font-semibold text-text-muted">Neu für dich</h2>
        <button
          type="button"
          onClick={onShowAll}
          className="min-h-tap px-1 text-subhead font-semibold text-accent"
        >
          Alle ›
        </button>
      </div>
      <ul className="flex flex-col overflow-hidden rounded-card bg-surface-2">
        {unread.slice(0, limit).map((notification) => (
          <li key={notification.id}>
            <NotificationItem
              notification={notification}
              onOpen={() => {
                markRead.mutate(notification.id);
                onOpenTarget(notification.target, {
                  thread: notification.commentId !== null,
                  commentId: notification.commentId,
                });
              }}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
