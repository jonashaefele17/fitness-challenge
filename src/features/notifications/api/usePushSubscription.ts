import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUserId } from '@/features/auth';
import { env } from '@/shared/lib/env';
import { supabase } from '@/shared/lib/supabase';
import { pushSupport, urlBase64ToUint8Array } from '../push';
import type { PushStatus } from '../types';
import { notificationKeys } from './useNotifications';

/** The active service worker, or null if none becomes ready (e.g. dev server without SW). */
async function readyRegistration(timeoutMs = 5000): Promise<ServiceWorkerRegistration | null> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
  return Promise.race([navigator.serviceWorker.ready, timeout]);
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await readyRegistration();
  return registration ? registration.pushManager.getSubscription() : null;
}

async function registerOnServer(subscription: PushSubscription) {
  const json = subscription.toJSON();
  const { error } = await supabase.rpc('register_push_subscription', {
    p_endpoint: subscription.endpoint,
    p_p256dh: json.keys?.p256dh ?? '',
    p_auth: json.keys?.auth ?? '',
    p_user_agent: navigator.userAgent,
  });
  if (error) throw error;
}

/** Push state of this device for the signed-in user. */
export function usePushStatus() {
  const userId = useUserId();
  return useQuery({
    queryKey: [...notificationKeys.all(userId), 'push'],
    queryFn: async (): Promise<PushStatus> => {
      const support = pushSupport(env.vapidPublicKey);
      if (support !== 'supported') return support;
      if (Notification.permission === 'denied') return 'denied';
      const registration = await readyRegistration();
      if (!registration) return 'unsupported';
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) return 'off';
      // Keep the device linked to whoever is signed in now (shared phones, re-installs).
      await registerOnServer(subscription);
      return 'on';
    },
  });
}

/**
 * Turns push on for this device. Must be called directly from a tap: iOS only shows the
 * permission prompt during a user gesture, so the prompt is requested before anything else.
 */
export function useEnablePush() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (permission: Promise<NotificationPermission>): Promise<PushStatus> => {
      if ((await permission) !== 'granted') return 'denied';
      if (!env.vapidPublicKey) return 'unconfigured';
      const registration = await readyRegistration();
      if (!registration) return 'unsupported';
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(env.vapidPublicKey),
        }));
      await registerOnServer(subscription);
      return 'on';
    },
    onSuccess: (status) => {
      queryClient.setQueryData([...notificationKeys.all(userId), 'push'], status);
    },
  });
}

/** Turns push off for this device (also used before signing out). */
export function useDisablePush() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async () => {
      if (pushSupport(env.vapidPublicKey) !== 'supported') return;
      const subscription = await currentSubscription();
      if (!subscription) return;
      const { error } = await supabase.rpc('unregister_push_subscription', {
        p_endpoint: subscription.endpoint,
      });
      if (error) throw error;
      await subscription.unsubscribe();
    },
    onSuccess: () => {
      queryClient.setQueryData<PushStatus>([...notificationKeys.all(userId), 'push'], 'off');
    },
  });
}
