import type { PersonColorKey } from '@/shared/design-tokens';

export type GroupRole = 'admin' | 'member';

/** A group as seen by the signed-in user, including their role in it. */
export interface GroupMembership {
  id: string;
  name: string;
  role: GroupRole;
  joinedAt: string;
}

/** A person in a group, with the public profile fields others may see. */
export interface GroupMember {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  color: PersonColorKey;
  role: GroupRole;
}
