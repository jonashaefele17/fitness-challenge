/**
 * Reference to any commentable object (CLAUDE.md rule 4): comments, reactions, feed events
 * and notifications point at objects through this, never through module-specific ids.
 */
export interface TargetRef {
  groupId: string;
  /** Key from the target_types table, e.g. "feed_event". */
  type: string;
  id: string;
  /** Optional position inside the object (e.g. set number). */
  index?: number | null;
}

/** Stable query-key fragment for a target. */
export function targetKey(target: TargetRef) {
  return [target.groupId, target.type, target.id, target.index ?? -1] as const;
}
