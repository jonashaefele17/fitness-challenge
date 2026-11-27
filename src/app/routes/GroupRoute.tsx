import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { HabitComparison, WeightComparison } from '@/features/comparison';
import { CommentBubble, CommentThreadSheet } from '@/features/comments';
import { FeedList, TrainedToday } from '@/features/feed';
import { useActiveGroup } from '@/features/groups';
import { NotificationBell, useInvalidateNotifications } from '@/features/notifications';
import { ReactionBar } from '@/features/reactions';
import { useWorkoutIdOfItem, WorkoutDetailSheet } from '@/features/training';
import { Screen, SegmentedControl } from '@/shared/ui';
import type { TargetRef } from '@/shared/types/target';
import { CardHabits } from '../feed/CardHabits';
import { CardSeason } from '../feed/CardSeason';
import { CardWeight } from '../feed/CardWeight';
import { CardWorkouts } from '../feed/CardWorkouts';
import { paths } from '../paths';
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
  const navigate = useNavigate();
  const [view, setView] = useState<'feed' | 'compare' | 'weight'>('feed');
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  // Linked from a notification: a workout, or an exercise/set of one.
  const linkedItem = params.get(targetParams.item);
  const linkedSet = params.get(targetParams.set);
  const itemWorkout = useWorkoutIdOfItem(linkedItem).data ?? null;
  const linkedWorkout = params.get(targetParams.workout) ?? itemWorkout;
  const shownWorkout = workoutId ?? linkedWorkout;

  return (
    <Screen title="Gruppe" accessory={<NotificationBell onOpenTarget={openTarget} />}>
      <div className="flex flex-col gap-4">
        <SegmentedControl
          label="Ansicht"
          value={view}
          onChange={setView}
          options={[
            { value: 'feed', label: 'Feed' },
            { value: 'compare', label: 'Habits' },
            { value: 'weight', label: 'Gewicht' },
          ]}
        />
        {view === 'compare' ? (
          <HabitComparison />
        ) : view === 'weight' ? (
          <WeightComparison
            onOpenSharing={() => {
              void navigate(
                `${paths.me}?${new URLSearchParams({ [targetParams.weightShare]: '1' }).toString()}`,
              );
            }}
          />
        ) : (
          <>
            <TrainedToday groupId={group.id} />
            <FeedList
              groupId={group.id}
              highlightId={focused?.id ?? null}
              renderBody={(card) => (
                <>
                  <CardWorkouts card={card} onOpen={setWorkoutId} />
                  <CardHabits card={card} />
                  <CardWeight card={card} />
                  <CardSeason
                    card={card}
                    onOpenSetup={(seasonId) => {
                      void navigate(
                        `${paths.me}?${new URLSearchParams({ [targetParams.season]: seasonId }).toString()}`,
                      );
                    }}
                  />
                </>
              )}
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
          </>
        )}
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
        workoutId={shownWorkout}
        focus={
          linkedItem && !workoutId
            ? { itemId: linkedItem, setIndex: linkedSet === null ? null : Number(linkedSet) }
            : null
        }
        onClose={() => {
          setWorkoutId(null);
          if (linkedWorkout) setParams({}, { replace: true });
        }}
      />
    </Screen>
  );
}
