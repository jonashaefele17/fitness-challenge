import { useEffect } from 'react';
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
    const consume = () => {
      void takePendingPushTarget().then((pending) => {
        if (!cancelled && pending) openTarget(pending.target, { thread: pending.thread });
      });
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') consume();
    };

    consume();
    document.addEventListener('visibilitychange', onVisible);
    const unsubscribe = onPushTargetMessage(consume);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      unsubscribe();
    };
  }, [openTarget]);

  return null;
}
