import { useState } from 'react';
import { CommentBubble, CommentThreadSheet } from '@/features/comments';
import type { Goal } from '@/features/goals';
import { useInvalidateNotifications } from '@/features/notifications';

/**
 * Comments on a season goal (target type "goal"), plugged into the goal detail: the bubble
 * with its count, and the generic thread above the detail.
 */
export function GoalComments({
  goal,
  groupId,
  defaultOpen = false,
}: {
  goal: Goal;
  groupId: string;
  /** Opened from a comment notification. */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const invalidateNotifications = useInvalidateNotifications();
  const target = { groupId, type: 'goal', id: goal.id };
  return (
    <div className="flex items-center">
      <CommentBubble
        target={target}
        onOpen={() => {
          setOpen(true);
        }}
      />
      <CommentThreadSheet
        target={target}
        open={open}
        onOpenChange={setOpen}
        title="Kommentare"
        onRead={() => void invalidateNotifications()}
      />
    </div>
  );
}
