import {
  PENDING_TARGET_CACHE,
  PENDING_TARGET_KEY,
  PUSH_TARGET_MESSAGE,
  type PendingPushTarget,
} from './push-protocol';

/** Returns (and removes) the jump target left by a tapped push notification, if any. */
export async function takePendingPushTarget(): Promise<PendingPushTarget | null> {
  if (!('caches' in window)) return null;
  try {
    const cache = await caches.open(PENDING_TARGET_CACHE);
    const response = await cache.match(PENDING_TARGET_KEY);
    if (!response) return null;
    await cache.delete(PENDING_TARGET_KEY);
    return (await response.json()) as PendingPushTarget;
  } catch {
    return null;
  }
}

/**
 * Calls back whenever the service worker reports a tapped notification, with its target
 * when the message carries it.
 */
export function onPushTargetMessage(
  callback: (pending: PendingPushTarget | null) => void,
): () => void {
  if (!('serviceWorker' in navigator)) return () => undefined;
  const handler = (event: MessageEvent<unknown>) => {
    const data = event.data;
    if (typeof data === 'object' && data !== null && 'type' in data) {
      if (data.type !== PUSH_TARGET_MESSAGE) return;
      const pending = 'pending' in data ? (data.pending as PendingPushTarget | undefined) : null;
      callback(pending ?? null);
    }
  };
  navigator.serviceWorker.addEventListener('message', handler);
  return () => {
    navigator.serviceWorker.removeEventListener('message', handler);
  };
}
