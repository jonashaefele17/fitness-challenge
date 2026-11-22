import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { useMemberLookup } from '@/features/groups';
import { Avatar } from '@/features/profile';
import { pressScale, spring } from '@/shared/design-tokens';
import { cn, formatRelativeTime } from '@/shared/lib';
import type { TargetRef } from '@/shared/types/target';
import { BellIcon, Button, Sheet } from '@/shared/ui';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadCount,
} from '../api/useNotifications';
import { describeNotification, isReminder } from '../settings';
import type { AppNotification } from '../types';

export interface OpenTargetOptions {
  /** Open the comment thread at the target. */
  thread: boolean;
  /** Comment to scroll to inside the thread. */
  commentId?: string | null;
}

export interface NotificationBellProps {
  /** Jumps to the object (composed in app, which knows the routes). */
  onOpenTarget: (target: TargetRef, options: OpenTargetOptions) => void;
  /** Open from outside too (e.g. "Alle ›" on Heute); without it the bell keeps its own state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** Bell with unread badge; opens the list of everything that concerns me. */
export function NotificationBell({
  onOpenTarget,
  open: openProp,
  onOpenChange,
}: NotificationBellProps) {
  const [ownOpen, setOwnOpen] = useState(false);
  const open = openProp ?? ownOpen;
  const setOpen = (next: boolean) => {
    setOwnOpen(next);
    onOpenChange?.(next);
  };
  const unread = useUnreadCount().data ?? 0;

  return (
    <>
      <motion.button
        type="button"
        aria-label={unread > 0 ? `Mitteilungen, ${String(unread)} ungelesen` : 'Mitteilungen'}
        whileTap={{ scale: pressScale }}
        transition={spring.press}
        onClick={() => {
          setOpen(true);
        }}
        className="relative flex size-tap items-center justify-center rounded-pill glass text-title-3"
      >
        <BellIcon />
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={spring.snappy}
              className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-pill bg-danger px-1 text-caption font-bold text-text"
            >
              {unread > 99 ? '99+' : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
      <NotificationsSheet
        open={open}
        onOpenChange={setOpen}
        onOpenTarget={(target, options) => {
          setOpen(false);
          onOpenTarget(target, options);
        }}
      />
    </>
  );
}

function NotificationsSheet({
  open,
  onOpenChange,
  onOpenTarget,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenTarget: NotificationBellProps['onOpenTarget'];
}) {
  const notifications = useNotifications({ enabled: open });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const items = notifications.data ?? [];
  const hasUnread = items.some((n) => n.readAt === null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Mitteilungen" className="min-h-sheet-min">
      {hasUnread && (
        <div className="-mt-2 mb-2 flex justify-end">
          <Button
            variant="ghost"
            onClick={() => {
              markAll.mutate();
            }}
          >
            Alle gelesen
          </Button>
        </div>
      )}
      {notifications.isPending ? (
        <p className="py-6 text-center text-subhead text-text-subtle">Lädt …</p>
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-subhead text-text-subtle">
          Noch keine Mitteilungen. Hier erscheint, was dich betrifft.
        </p>
      ) : (
        <ul className="-mx-gutter flex flex-col">
          {items.map((notification) => (
            <li key={notification.id}>
              <NotificationItem
                notification={notification}
                onOpen={() => {
                  if (notification.readAt === null) markRead.mutate(notification.id);
                  onOpenTarget(notification.target, {
                    thread: notification.commentId !== null,
                    commentId: notification.commentId,
                  });
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

export function NotificationItem({
  notification,
  onOpen,
}: {
  notification: AppNotification;
  onOpen: () => void;
}) {
  const actor = useMemberLookup(notification.groupId)(notification.actorId);
  const unread = notification.readAt === null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'flex w-full items-start gap-3 px-gutter py-3 text-left active:bg-surface-2',
        unread && 'bg-surface-2/40',
      )}
    >
      {actor ? <Avatar profile={actor} /> : <span className="size-10 shrink-0" />}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-subhead">
          {isReminder(notification.event) ? (
            <span className="font-semibold">{describeNotification(notification)}</span>
          ) : (
            <>
              <span className="font-semibold">{actor?.displayName ?? 'Jemand'}</span>{' '}
              {describeNotification(notification)}
            </>
          )}
        </span>
        {notification.preview && (
          <span className="truncate text-footnote text-text-muted">„{notification.preview}“</span>
        )}
        <span className="text-caption text-text-subtle">
          {formatRelativeTime(notification.createdAt)}
        </span>
      </span>
      {unread && (
        <span aria-label="ungelesen" className="mt-2 size-2.5 shrink-0 rounded-pill bg-accent" />
      )}
    </button>
  );
}
