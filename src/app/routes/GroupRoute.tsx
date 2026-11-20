import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { CommentBubble, CommentThreadSheet } from '@/features/comments';
import { FeedList } from '@/features/feed';
import { useActiveGroup } from '@/features/groups';
import { NotificationBell, useInvalidateNotifications } from '@/features/notifications';
import { ReactionButton } from '@/features/reactions';
import { Screen } from '@/shared/ui';
import { targetParams, useOpenTarget } from '../targets';

export function GroupRoute() {
  const { group } = useActiveGroup();
  const openTarget = useOpenTarget();
  const invalidateNotifications = useInvalidateNotifications();
  const [params, setParams] = useSearchParams();
  const focusedEventId = params.get(targetParams.feedEvent);
  const threadOpen = focusedEventId !== null && params.get(targetParams.thread) === '1';
  // Keep the last thread mounted after closing so the sheet can animate out
  // (state derived during render, as recommended by React).
  const [threadEventId, setThreadEventId] = useState<string | null>(null);
  if (threadOpen && focusedEventId !== threadEventId) setThreadEventId(focusedEventId);

  return (
    <Screen title="Gruppe" accessory={<NotificationBell onOpenTarget={openTarget} />}>
      <p className="-mt-2 mb-4 text-subhead text-text-muted">{group.name}</p>
      <FeedList
        groupId={group.id}
        highlightId={focusedEventId}
        renderActions={(event) => {
          const target = { groupId: group.id, type: 'feed_event', id: event.id };
          return (
            <>
              <ReactionButton target={target} />
              <CommentBubble
                target={target}
                onOpen={() => {
                  setParams({ [targetParams.feedEvent]: event.id, [targetParams.thread]: '1' });
                }}
              />
            </>
          );
        }}
      />
      {threadEventId && (
        <CommentThreadSheet
          target={{ groupId: group.id, type: 'feed_event', id: threadEventId }}
          open={threadOpen}
          onOpenChange={(open) => {
            if (!open) setParams({}, { replace: true });
          }}
          onRead={() => void invalidateNotifications()}
        />
      )}
    </Screen>
  );
}
