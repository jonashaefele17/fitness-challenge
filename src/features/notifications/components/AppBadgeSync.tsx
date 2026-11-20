import { useEffect } from 'react';
import { useUnreadCount } from '../api/useNotifications';

/** Mirrors the unread count onto the home-screen icon where supported (iOS 16.4+ PWA). */
export function AppBadgeSync() {
  const unread = useUnreadCount().data;

  useEffect(() => {
    if (unread === undefined || !('setAppBadge' in navigator)) return;
    const request = unread > 0 ? navigator.setAppBadge(unread) : navigator.clearAppBadge();
    // Rejected without notification permission; the bell still shows the count.
    request.catch(() => undefined);
  }, [unread]);

  return null;
}
