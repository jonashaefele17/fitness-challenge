import { useQueries } from '@tanstack/react-query';
import { useUserId } from '@/features/auth';
import { useActiveGroup, useGroupMembers } from '@/features/groups';
import {
  exerciseSessionsOptions,
  type HistoryCompare,
  type HistoryScope,
} from '@/features/training';
import { personColorVar } from '@/shared/design-tokens';

/**
 * Fills training's history comparison slot: the other members of the active group who
 * have done this exercise in the same scope (same machine, or comparable / all devices),
 * each in their person colour. Visibility is enforced by the database (shared data only).
 */
export function useHistoryCompare(scope: HistoryScope): HistoryCompare {
  const userId = useUserId();
  const { group } = useActiveGroup();
  const members = useGroupMembers(group.id).data ?? [];
  const others = members.filter((member) => member.userId !== userId);
  const results = useQueries({
    queries: others.map((member) => exerciseSessionsOptions(userId, scope, member.userId)),
  });
  const me = members.find((member) => member.userId === userId);

  return {
    myColor: me ? personColorVar(me.color) : null,
    people: others.flatMap((member, index) => {
      const sessions = results[index]?.data ?? [];
      return sessions.length === 0
        ? []
        : [
            {
              id: member.userId,
              name: member.displayName,
              color: personColorVar(member.color),
              sessions,
            },
          ];
    }),
  };
}
