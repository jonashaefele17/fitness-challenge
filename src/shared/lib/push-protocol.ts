// Contract between the edge function "send-push", the service worker and the app.
// Kept free of DOM/WebWorker types so both builds can import it.

export interface PushTarget {
  groupId: string;
  type: string;
  id: string;
  index: number | null;
}

/** JSON payload of a push message (built in supabase/functions/send-push). */
export interface PushPayload {
  title: string;
  body: string;
  tag: string;
  target: PushTarget;
  /** Open the comment thread at the target. */
  thread: boolean;
  /** Unread count for the app icon badge. */
  unread: number;
}

/** Where the service worker leaves the jump target for the app (iOS ignores URLs on click). */
export const PENDING_TARGET_CACHE = 'push-navigation';
export const PENDING_TARGET_KEY = '/__pending-push-target';

/** Message the service worker posts to an open app after a notification was tapped. */
export const PUSH_TARGET_MESSAGE = 'push-target';

export interface PendingPushTarget {
  target: PushTarget;
  thread: boolean;
}
