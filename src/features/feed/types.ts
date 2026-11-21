import type { Json } from '@/shared/types/database';

export interface FeedEvent {
  id: string;
  groupId: string;
  actorId: string;
  /** Key from feed_event_types, e.g. "member_joined". */
  type: string;
  targetType: string | null;
  targetId: string | null;
  data: Json;
  createdAt: string;
}
