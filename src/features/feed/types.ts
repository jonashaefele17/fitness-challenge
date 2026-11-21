import type { Json } from '@/shared/types/database';

export interface FeedEvent {
  id: string;
  /** Key from feed_event_types, e.g. "workout_finished", "member_joined". */
  type: string;
  targetType: string | null;
  targetId: string | null;
  data: Json;
  /** When it happened (a workout's start). */
  occurredAt: string;
  /** When it was posted. */
  createdAt: string;
}

/** One person's day in the group: everything they did that day. */
export interface FeedCard {
  id: string;
  groupId: string;
  actorId: string;
  /** Local day, "2026-11-21". */
  day: string;
  /** A person's day, or the small card for joining the group. */
  kind: 'day' | 'joined';
  latestAt: string;
  lastActivityAt: string;
  events: FeedEvent[];
}

/** "Neueste" (newest day first) or "Zuletzt aktiv" (latest comment/reaction first). */
export type FeedSort = 'newest' | 'active';
