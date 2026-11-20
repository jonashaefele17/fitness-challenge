export type GroupRole = 'admin' | 'member';

/** A group as seen by the signed-in user, including their role in it. */
export interface GroupMembership {
  id: string;
  name: string;
  role: GroupRole;
  joinedAt: string;
}
