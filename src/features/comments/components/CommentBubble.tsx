import { motion } from 'motion/react';
import { pressScale, spring } from '@/shared/design-tokens';
import { cn } from '@/shared/lib';
import type { TargetRef } from '@/shared/types/target';
import { ChatIcon } from '@/shared/ui';
import { useCommentStats } from '../api/useComments';

export interface CommentBubbleProps {
  target: TargetRef;
  onOpen: () => void;
}

/**
 * Small speech bubble with the comment count (like the corner mark in a spreadsheet).
 * Turns red while there are unread comments: "4 · 2 neu".
 */
export function CommentBubble({ target, onOpen }: CommentBubbleProps) {
  const stats = useCommentStats(target);
  const total = stats.data?.total ?? 0;
  const unread = stats.data?.unread ?? 0;

  const label =
    total === 0
      ? 'Kommentieren'
      : `${String(total)} Kommentar${total === 1 ? '' : 'e'}${unread > 0 ? `, ${String(unread)} neu` : ''}`;

  return (
    <motion.button
      type="button"
      aria-label={label}
      whileTap={{ scale: pressScale }}
      transition={spring.press}
      onClick={onOpen}
      className={cn(
        'flex min-h-tap items-center gap-1.5 rounded-pill px-3 text-subhead font-semibold transition-colors duration-(--duration-fast)',
        unread > 0 ? 'text-danger' : 'text-text-muted active:bg-surface-2',
      )}
    >
      <ChatIcon className="text-title-3" />
      {total > 0 && <span>{total}</span>}
      {unread > 0 && <span className="font-medium">· {unread} neu</span>}
    </motion.button>
  );
}
