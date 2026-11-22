// Sends due Web Push notifications. Called every minute by pg_cron (see the push migration).
// Auth: shared secret in the x-cron-secret header (the function is deployed without JWT check).
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

interface PushItem {
  id: string;
  event: string;
  category: string;
  actorName: string | null;
  preview: string | null;
  /** Reactions: the emoji given. */
  emoji?: string | null;
  target: { groupId: string; type: string; id: string; index: number | null };
  thread: boolean;
  commentId: string | null;
}

interface Delivery {
  user_id: string;
  notifications: PushItem[];
  unread: number;
  subscriptions: { id: string; endpoint: string; p256dh: string; auth: string }[];
}

const APP_NAME = 'Fitness Challenge';

// Keep in sync with ownObject / describeNotification in src/features/notifications/settings.ts.
function ownObject(target: PushItem['target']): string {
  switch (target.type) {
    case 'workout':
      return 'dein Training';
    case 'workout_item':
      return target.index === null ? 'deine Übung' : 'deinen Satz';
    default:
      return 'deinen Beitrag';
  }
}

function describe(item: PushItem): string {
  switch (item.event) {
    case 'mention':
      return 'hat dich erwähnt';
    case 'reply':
      return 'hat geantwortet';
    case 'reaction':
      return `hat mit ${item.emoji ?? '🔥'} reagiert`;
    case 'workout_finished':
      return 'hat trainiert';
    case 'member_joined':
      return 'ist der Gruppe beigetreten';
    case 'plan_invite':
      return 'lädt dich zu einem Termin ein';
    case 'plan_accepted':
      return 'hat zugesagt';
    case 'plan_maybe':
      return 'kommt vielleicht';
    case 'plan_declined':
      return 'hat abgesagt';
    case 'plan_proposed':
      return 'schlägt eine andere Zeit vor';
    case 'plan_request':
      return 'möchte mitkommen';
    case 'plan_request_accepted':
      return 'nimmt dich mit';
    case 'plan_request_declined':
      return 'nimmt diesmal niemanden mit';
    case 'plan_changed':
      return 'hat einen Termin geändert – bitte neu zusagen';
    case 'plan_cancelled':
      return 'hat einen Termin abgesagt';
    case 'comment':
      return item.category === 'comments_on_mine'
        ? `hat ${ownObject(item.target)} kommentiert`
        : 'hat kommentiert';
    default:
      return 'hat etwas Neues';
  }
}

/** One notification → its sentence; several → a summary that opens the latest. */
export function buildPayload(items: PushItem[], unread: number) {
  const latest = items[items.length - 1];
  if (!latest) throw new Error('empty delivery');
  if (items.length === 1) {
    return {
      title: `${latest.actorName ?? 'Jemand'} ${describe(latest)}`,
      body: latest.preview ?? '',
      tag: `${latest.target.type}:${latest.target.id}`,
      target: latest.target,
      thread: latest.thread,
      commentId: latest.commentId,
      unread,
    };
  }
  const names = [...new Set(items.map((item) => item.actorName ?? 'Jemand'))];
  return {
    title: `${String(items.length)} neue Mitteilungen`,
    body: `Von ${names.slice(0, 3).join(', ')}${names.length > 3 ? ' und weiteren' : ''}`,
    tag: 'bundle',
    target: latest.target,
    thread: latest.thread,
    commentId: latest.commentId,
    unread,
  };
}

Deno.serve(async (request) => {
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret || request.headers.get('x-cron-secret') !== secret) {
    return new Response('forbidden', { status: 403 });
  }

  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const subject =
    Deno.env.get('VAPID_SUBJECT') ?? 'https://jonashaefele17.github.io/fitness-challenge/';
  if (!publicKey || !privateKey) {
    return new Response('VAPID keys missing', { status: 500 });
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );

  const { data, error } = await supabase.rpc('claim_push_deliveries');
  if (error) {
    console.error('claim_push_deliveries failed', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const deliveries = (data ?? []) as Delivery[];
  let sent = 0;
  let failed = 0;

  for (const delivery of deliveries) {
    const payload = JSON.stringify(buildPayload(delivery.notifications, delivery.unread));
    for (const subscription of delivery.subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload,
          { TTL: 60 * 60 * 24, urgency: 'normal' },
        );
        sent++;
        await supabase.rpc('report_push_result', {
          p_subscription_id: subscription.id,
          p_ok: true,
          p_gone: false,
        });
      } catch (err) {
        failed++;
        const status = (err as { statusCode?: number }).statusCode;
        // 404/410: the device unsubscribed or the app was removed.
        const gone = status === 404 || status === 410;
        console.warn('push failed', status, subscription.id, (err as Error).message);
        await supabase.rpc('report_push_result', {
          p_subscription_id: subscription.id,
          p_ok: false,
          p_gone: gone,
        });
      }
    }
  }

  return new Response(
    JSON.stringify({ app: APP_NAME, deliveries: deliveries.length, sent, failed }),
    {
      headers: { 'Content-Type': 'application/json' },
    },
  );
});
