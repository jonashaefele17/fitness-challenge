import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import type { TargetRef } from '@/shared/types/target';
import { paths } from './paths';

export const targetParams = {
  /** Feed card to scroll to. */
  feedEvent: 'beitrag',
  /** "1" opens the comment thread of that card. */
  thread: 'thread',
} as const;

/**
 * Where an object lives in the app. The only place that maps target types to routes;
 * new commentable types (workout, set …) add a case here.
 */
export function targetPath(target: TargetRef, { thread }: { thread: boolean }): string {
  switch (target.type) {
    case 'feed_event': {
      const params = new URLSearchParams({ [targetParams.feedEvent]: target.id });
      if (thread) params.set(targetParams.thread, '1');
      return `${paths.group}?${params.toString()}`;
    }
    default:
      return paths.group;
  }
}

export function useOpenTarget() {
  const navigate = useNavigate();
  return useCallback(
    (target: TargetRef, options: { thread: boolean }) => {
      void navigate(targetPath(target, options));
    },
    [navigate],
  );
}
