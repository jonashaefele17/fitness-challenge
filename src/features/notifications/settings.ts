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
export function describeNotification(notification: Pick<AppNotification, 'event' | 'category'>) {
  switch (notification.event) {
    case 'mention':
      return 'hat dich erwähnt';
    case 'reply':
      return 'hat geantwortet';
    case 'reaction':
      return 'hat mit 🔥 reagiert';
    case 'member_joined':
      return 'ist der Gruppe beigetreten';
    case 'comment':
      return notification.category === 'comments_on_mine'
        ? 'hat deinen Beitrag kommentiert'
        : 'hat kommentiert';
    default:
      return 'hat etwas Neues';
  }
}
