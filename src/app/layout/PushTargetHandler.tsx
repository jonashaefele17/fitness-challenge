import { useEffect } from 'react';
import type { PendingPushTarget } from '@/shared/lib/push-protocol';
import { onPushTargetMessage, takePendingPushTarget } from '@/shared/lib/push-target';
import { useOpenTarget } from '../targets';

/**
 * Opens the object of a tapped push notification. The service worker stores the target;
 * we pick it up on start, when the app becomes visible, and when the worker pings us.
 */
export function PushTargetHandler() {
  const openTarget = useOpenTarget();

  useEffect(() => {
    let cancelled = false;
    const open = (pending: PendingPushTarget) => {
      openTarget(pending.target, { thread: pending.thread, commentId: pending.commentId });
    };
    const consume = () => {
      void takePendingPushTarget().then((pending) => {
        if (!cancelled && pending) open(pending);
      });
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') consume();
    };

    consume();
    // iOS brings the app back with different events; check on each.
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', consume);
    window.addEventListener('pageshow', consume);
    const unsubscribe = onPushTargetMessage((pending) => {
      if (pending) {
        // Opened from the message; drop the stored copy so it does not open twice.
        void takePendingPushTarget();
        open(pending);
      } else {
        consume();
      }
    });
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', consume);
      window.removeEventListener('pageshow', consume);
      unsubscribe();
    };
  }, [openTarget]);

  return null;
}
