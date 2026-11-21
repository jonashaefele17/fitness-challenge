import type { PushStatus } from './types';

/** iPhone/iPad, including iPadOS that reports itself as a Mac. */
export function isIOS(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes('Mac') && navigator.maxTouchPoints > 1)
  );
}

/** Running as an installed home-screen app. */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Whether Web Push can work here; iOS only allows it in the installed app. */
export function pushSupport(
  vapidPublicKey: string | null,
): Extract<PushStatus, 'supported' | 'unsupported' | 'needs-install' | 'unconfigured'> {
  if (!vapidPublicKey) return 'unconfigured';
  if (isIOS() && !isStandalone()) return 'needs-install';
  const supported =
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  return supported ? 'supported' : 'unsupported';
}

/** VAPID keys are base64url; the Push API wants raw bytes. */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalised);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
