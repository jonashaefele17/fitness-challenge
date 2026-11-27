import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import type { TargetRef } from '@/shared/types/target';
import { paths } from './paths';

export const targetParams = {
  /** Day card in the feed to scroll to. */
  card: 'karte',
  /** Feed event to scroll to (its day card). */
  feedEvent: 'beitrag',
  /** Workout to open. */
  workout: 'training',
  /** Exercise of a workout to open (and scroll to). */
  item: 'uebung',
  /** Set of that exercise (its position) to mark. */
  set: 'satz',
  /** "1" opens the comment thread of that card. */
  thread: 'thread',
  /** Comment to scroll to inside the open thread. */
  comment: 'kommentar',
  /** Plan whose next date to open (training tab). */
  plan: 'termin',
  /** Habit to open in today's check-in (reminders). */
  checkin: 'checkin',
  /** "1" opens Ich → Körper with the weigh-in (weigh reminder). */
  weigh: 'wiegen',
  /** "1" opens Ich → Körper with "Sichtbarkeit" (who sees my weight). */
  weightShare: 'sichtbarkeit',
  /** "1" opens Ich → Körper with the Zwischenstand (its reminder). */
  bodyCheckin: 'zwischenstand',
} as const;

export interface OpenTargetOptions {
  thread: boolean;
  commentId?: string | null | undefined;
}

/**
 * Where an object lives in the app. The only place that maps target types to routes;
 * new commentable types (workout, set …) add a case here.
 */
export function targetPath(target: TargetRef, { thread, commentId }: OpenTargetOptions): string {
  switch (target.type) {
    case 'feed_day':
    case 'feed_event': {
      const key = target.type === 'feed_day' ? targetParams.card : targetParams.feedEvent;
      const params = new URLSearchParams({ [key]: target.id });
      if (thread) params.set(targetParams.thread, '1');
      if (thread && commentId) params.set(targetParams.comment, commentId);
      return `${paths.group}?${params.toString()}`;
    }
    case 'workout':
    case 'workout_item': {
      const params = new URLSearchParams(
        target.type === 'workout'
          ? { [targetParams.workout]: target.id }
          : { [targetParams.item]: target.id },
      );
      if (target.type === 'workout_item' && target.index != null) {
        params.set(targetParams.set, String(target.index));
      }
      if (thread) params.set(targetParams.thread, '1');
      if (thread && commentId) params.set(targetParams.comment, commentId);
      return `${paths.group}?${params.toString()}`;
    }
    case 'habit':
      return `${paths.today}?${new URLSearchParams({ [targetParams.checkin]: target.id }).toString()}`;
    case 'live_workout':
      return paths.liveWorkout;
    case 'body':
      return `${paths.me}?${new URLSearchParams({ [targetParams.weigh]: '1' }).toString()}`;
    case 'body_checkin':
      return `${paths.me}?${new URLSearchParams({ [targetParams.bodyCheckin]: '1' }).toString()}`;
    case 'plan':
      return `${paths.training}?${new URLSearchParams({ [targetParams.plan]: target.id }).toString()}`;
    default:
      return paths.group;
  }
}

export function useOpenTarget() {
  const navigate = useNavigate();
  return useCallback(
    (target: TargetRef, options: OpenTargetOptions) => {
      void navigate(targetPath(target, options));
    },
    [navigate],
  );
}
