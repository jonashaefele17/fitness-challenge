import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { CommentBubble, CommentThreadSheet } from '@/features/comments';
import { FeedList, TrainedToday } from '@/features/feed';
import { useActiveGroup } from '@/features/groups';
import { NotificationBell, useInvalidateNotifications } from '@/features/notifications';
import { ReactionBar } from '@/features/reactions';
import { WorkoutDetailSheet } from '@/features/training';
import { Screen } from '@/shared/ui';
import type { TargetRef } from '@/shared/types/target';
import { CardWorkouts } from '../feed/CardWorkouts';
import { targetParams, useOpenTarget } from '../targets';

/** Thread target from the address: a day card, or (older notifications) a feed event. */
function threadTarget(params: URLSearchParams, groupId: string): TargetRef | null {
  const card = params.get(targetParams.card);
  if (card) return { groupId, type: 'feed_day', id: card };
  const event = params.get(targetParams.feedEvent);
  if (event) return { groupId, type: 'feed_event', id: event };
  return null;
}

export function GroupRoute() {
  const { group } = useActiveGroup();
  const openTarget = useOpenTarget();
  const invalidateNotifications = useInvalidateNotifications();
  const [params, setParams] = useSearchParams();
  const focused = threadTarget(params, group.id);
  const threadOpen = focused !== null && params.get(targetParams.thread) === '1';
  const focusCommentId = params.get(targetParams.comment);
  // Keep the last thread mounted after closing so the sheet can animate out
  // (state derived during render, as recommended by React).
  const [thread, setThread] = useState<TargetRef | null>(null);
  if (threadOpen && (focused.id !== thread?.id || focused.type !== thread.type)) {
    setThread(focused);
  }
  const [workoutId, setWorkoutId] = useState<string | null>(null);

  return (
    <Screen title="Gruppe" accessory={<NotificationBell onOpenTarget={openTarget} />}>
      <div className="flex flex-col gap-4">
        <TrainedToday groupId={group.id} />
        <FeedList
          groupId={group.id}
          highlightId={focused?.id ?? null}
          renderBody={(card) => <CardWorkouts card={card} onOpen={setWorkoutId} />}
          renderActions={(card) => {
            const target = { groupId: group.id, type: 'feed_day', id: card.id };
            return (
              <>
                <ReactionBar target={target} />
                <CommentBubble
                  target={target}
                  onOpen={() => {
                    setParams({ [targetParams.card]: card.id, [targetParams.thread]: '1' });
                  }}
                />
              </>
            );
          }}
        />
      </div>
      {thread && (
        <CommentThreadSheet
          target={thread}
          open={threadOpen}
          focusCommentId={threadOpen ? focusCommentId : null}
          onOpenChange={(open) => {
            if (!open) setParams({}, { replace: true });
          }}
          onRead={() => void invalidateNotifications()}
        />
      )}
      <WorkoutDetailSheet
        workoutId={workoutId}
        onClose={() => {
          setWorkoutId(null);
        }}
      />
    </Screen>
  );
}
