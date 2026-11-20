import type { TargetRef } from '@/shared/types/target';

export interface AppNotification {
  id: string;
  groupId: string;
  category: string;
  /** comment | reply | mention | reaction | member_joined */
  event: string;
  actorId: string | null;
  target: TargetRef;
  commentId: string | null;
  preview: string | null;
  createdAt: string;
  readAt: string | null;
}

export type Preset = 'important' | 'standard' | 'all';

export interface NotificationCategory {
  key: string;
  label: string;
  description: string;
  presets: Record<Preset, boolean>;
}

export interface NotificationPrefs {
  preset: Preset;
  bundle: boolean;
  quietHoursEnabled: boolean;
  /** "HH:MM" */
  quietStart: string;
  quietEnd: string;
  timeZone: string;
}

export interface NotificationSettings {
  categories: NotificationCategory[];
  prefs: NotificationPrefs;
  overrides: Record<string, boolean>;
}
