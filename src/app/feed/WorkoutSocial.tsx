import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { CommentBubble, CommentThreadSheet, useCommentStatsByIndex } from '@/features/comments';
import { useActiveGroup } from '@/features/groups';
import { useInvalidateNotifications } from '@/features/notifications';
import { ReactionBar, useReactionsByIndex } from '@/features/reactions';
import { WorkoutSocialContext, type WorkoutSocialSlots } from '@/features/training';
import { cn } from '@/shared/lib';
import { ChatIcon } from '@/shared/ui';
import type { TargetRef } from '@/shared/types/target';
import { targetParams } from '../targets';

/**
 * A thread opened by tapping, or linked from a notification (address of the group tab:
 * ?training=… / ?uebung=…&satz=…, plus thread=1 and the comment to scroll to).
 */
function useThreadOpen(link: { workoutId?: string; itemId?: string; index?: number | null }) {
  const [params, setParams] = useSearchParams();
  const [tapped, setTapped] = useState(false);
  const item = params.get(targetParams.item);
  const set = params.get(targetParams.set);
  const linked =
    params.get(targetParams.thread) === '1' &&
    (link.workoutId !== undefined
      ? params.get(targetParams.workout) === link.workoutId && item === null
      : item === link.itemId && (link.index == null ? set === null : set === String(link.index)));
  return {
    open: tapped || linked,
    focusCommentId: linked ? params.get(targetParams.comment) : null,
    openThread: () => {
      setTapped(true);
    },
    close: () => {
      setTapped(false);
      if (linked) {
        setParams(
          (current) => {
            const next = new URLSearchParams(current);
            next.delete(targetParams.thread);
            next.delete(targetParams.comment);
            return next;
          },
          { replace: true },
        );
      }
    },
  };
}

/** A thread for one target, stacked on the sheet it is opened from. */
function Thread({
  target,
  title,
  open,
  onClose,
  withReactions,
  focusCommentId,
}: {
  target: TargetRef;
  title: string;
  open: boolean;
  onClose: () => void;
  withReactions: boolean;
  focusCommentId: string | null;
}) {
  const invalidateNotifications = useInvalidateNotifications();
  return (
    <CommentThreadSheet
      target={target}
      title={title}
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      onRead={() => void invalidateNotifications()}
      focusCommentId={focusCommentId}
      header={withReactions ? <ReactionBar target={target} /> : undefined}
    />
  );
}

function WorkoutActions({ workoutId, title }: { workoutId: string; title: string }) {
  const { group } = useActiveGroup();
  const thread = useThreadOpen({ workoutId });
  const target = { groupId: group.id, type: 'workout', id: workoutId };
  return (
    <div className="flex items-center gap-2">
      <ReactionBar target={target} />
      <CommentBubble
        target={target}
        onOpen={() => {
          thread.openThread();
        }}
      />
      <Thread
        target={target}
        title={title}
        open={thread.open}
        onClose={thread.close}
        focusCommentId={thread.focusCommentId}
        withReactions={false}
      />
    </div>
  );
}

function ExerciseBubble({ itemId, title }: { itemId: string; title: string }) {
  const { group } = useActiveGroup();
  const thread = useThreadOpen({ itemId });
  const target = { groupId: group.id, type: 'workout_item', id: itemId };
  const emojis = useReactionsByIndex(target).get('') ?? [];
  return (
    <div className="flex shrink-0 items-center">
      {emojis.length > 0 && (
        <span aria-label={`Reaktionen: ${emojis.join(' ')}`} className="text-footnote">
          {emojis.join('')}
        </span>
      )}
      <CommentBubble
        target={target}
        onOpen={() => {
          thread.openThread();
        }}
      />
      <Thread
        target={target}
        title={title}
        open={thread.open}
        onClose={thread.close}
        focusCommentId={thread.focusCommentId}
        withReactions
      />
    </div>
  );
}

function SetRow({
  itemId,
  index,
  title,
  children,
}: {
  itemId: string;
  index: number;
  title: string;
  children: ReactNode;
}) {
  const { group } = useActiveGroup();
  const thread = useThreadOpen({ itemId, index });
  const item = { groupId: group.id, type: 'workout_item', id: itemId };
  const stats = useCommentStatsByIndex(item).data?.get(String(index));
  const emojis = useReactionsByIndex(item).get(String(index)) ?? [];
  const total = stats?.total ?? 0;
  const unread = stats?.unread ?? 0;
  return (
    <>
      <button
        type="button"
        aria-label={`${title}: kommentieren oder reagieren`}
        onClick={() => {
          thread.openThread();
        }}
        className="-mx-2 flex min-h-8 w-[calc(100%+var(--spacing)*4)] items-center justify-between gap-2 rounded-sm px-2 text-left active:bg-surface-3"
      >
        {children}
        <span className="flex shrink-0 items-center gap-1.5 text-footnote">
          {emojis.length > 0 && <span aria-hidden>{emojis.join('')}</span>}
          {total > 0 && (
            <span
              className={cn(
                'flex items-center gap-0.5 font-semibold',
                unread > 0 ? 'text-danger' : 'text-text-muted',
              )}
            >
              <ChatIcon aria-hidden />
              {total}
            </span>
          )}
        </span>
      </button>
      <Thread
        target={{ ...item, index }}
        title={title}
        open={thread.open}
        onClose={thread.close}
        focusCommentId={thread.focusCommentId}
        withReactions
      />
    </>
  );
}

const slots: WorkoutSocialSlots = {
  Workout: WorkoutActions,
  Exercise: ExerciseBubble,
  Set: SetRow,
};

/** Plugs comments and reactions into every workout detail (calendar, feed …). */
export function WorkoutSocialProvider({ children }: { children: ReactNode }) {
  return <WorkoutSocialContext.Provider value={slots}>{children}</WorkoutSocialContext.Provider>;
}
