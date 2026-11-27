import type { AppNotification, NotificationCategory, NotificationPrefs, Preset } from './types';

export const presets: { value: Preset; label: string }[] = [
  { value: 'important', label: 'Nur Wichtiges' },
  { value: 'standard', label: 'Standard' },
  { value: 'all', label: 'Alles' },
];

export function isPreset(value: string): value is Preset {
  return value === 'important' || value === 'standard' || value === 'all';
}

export function defaultPrefs(): NotificationPrefs {
  return {
    preset: 'standard',
    bundle: false,
    quietHoursEnabled: true,
    quietStart: '22:00',
    quietEnd: '07:00',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

/** Mirrors private.wants_category in the database: override first, else the preset. */
export function isCategoryEnabled(
  category: NotificationCategory,
  preset: Preset,
  overrides: Record<string, boolean>,
): boolean {
  return overrides[category.key] ?? category.presets[preset];
}

/** German sentence for the bell, e.g. "hat deinen Beitrag kommentiert". */
/** "deinen Satz" / "deine Übung" / "dein Training" / "deinen Beitrag". */
export function ownObject(target?: { type: string; index?: number | null }): string {
  switch (target?.type) {
    case 'workout':
      return 'dein Training';
    case 'workout_item':
      return target.index == null ? 'deine Übung' : 'deinen Satz';
    default:
      return 'deinen Beitrag';
  }
}

/** Reminders come from no one: their sentence stands alone. */
export function isReminder(event: string): boolean {
  return (
    event === 'checkin_reminder' ||
    event === 'supplement_reminder' ||
    event === 'weigh_reminder' ||
    event === 'body_checkin_reminder' ||
    event === 'season_ready_reminder' ||
    event === 'season_started'
  );
}

export function describeNotification(
  notification: Pick<AppNotification, 'event' | 'category'> & {
    emoji?: string | null;
    target?: { type: string; index?: number | null };
  },
) {
  switch (notification.event) {
    case 'mention':
      return 'hat dich erwähnt';
    case 'reply':
      return 'hat geantwortet';
    case 'reaction':
      return `hat mit ${notification.emoji ?? '🔥'} reagiert`;
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
    case 'live_started':
      return 'hat euer Training gestartet';
    case 'checkin_reminder':
      return 'Check-in: noch offen';
    case 'supplement_reminder':
      return 'Zeit für deine Supplements';
    case 'weigh_reminder':
      return 'Wiegen';
    case 'body_checkin_reminder':
      return 'Zwischenstand';
    case 'season_setup':
      return 'lädt dich zur Saison ein';
    case 'season_ready_reminder':
      return 'Morgen startet die Saison';
    case 'season_started':
      return 'Die Saison läuft';
    case 'season_goal_corrected':
      return 'hat dein Saisonziel korrigiert';
    case 'comment':
      return notification.category === 'comments_on_mine'
        ? `hat ${ownObject(notification.target)} kommentiert`
        : 'hat kommentiert';
    default:
      return 'hat etwas Neues';
  }
}
