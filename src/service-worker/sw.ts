/// <reference lib="webworker" />
// Service worker: offline app shell (precache) plus Web Push display and tap handling.
import { clientsClaim } from 'workbox-core';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import {
  PENDING_TARGET_CACHE,
  PENDING_TARGET_KEY,
  PUSH_TARGET_MESSAGE,
  type PendingPushTarget,
  type PushPayload,
} from '../shared/lib/push-protocol';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: (string | { url: string; revision: string | null })[];
};

// New versions take over immediately (registerType "autoUpdate").
void self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
// Single-page app: every navigation (incl. ?code=… after OAuth) gets the app shell.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

function readPayload(event: PushEvent): PushPayload | null {
  try {
    return (event.data?.json() as PushPayload | undefined) ?? null;
  } catch {
    return null;
  }
}

self.addEventListener('push', (event) => {
  const payload = readPayload(event);
  if (!payload) return;

  const data: PendingPushTarget = { target: payload.target, thread: payload.thread };
  const tasks: Promise<unknown>[] = [
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      data,
      icon: 'pwa-192x192.png',
      badge: 'pwa-64x64.png',
    }),
  ];
  if ('setAppBadge' in self.navigator) {
    tasks.push(self.navigator.setAppBadge(payload.unread).catch(() => undefined));
  }
  event.waitUntil(Promise.all(tasks));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data as PendingPushTarget | undefined;

  event.waitUntil(
    (async () => {
      // iOS does not reliably open a URL from a notification tap, so the jump target is
      // stored locally and the app picks it up when it becomes visible.
      if (data) {
        const cache = await caches.open(PENDING_TARGET_CACHE);
        await cache.put(PENDING_TARGET_KEY, new Response(JSON.stringify(data)));
      }
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const client = windows[0];
      if (client) {
        client.postMessage({ type: PUSH_TARGET_MESSAGE });
        await client.focus();
      } else {
        await self.clients.openWindow(self.registration.scope);
      }
    })(),
  );
});
