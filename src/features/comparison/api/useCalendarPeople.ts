import { useQueries } from '@tanstack/react-query';
import { useUserId } from '@/features/auth';
import { useActiveGroup, useGroupMembers } from '@/features/groups';
import {
  planOccurrencesOptions,
  workoutsInRangeOptions,
  type CalendarPeople,
} from '@/features/training';
import { personColorVar } from '@/shared/design-tokens';

/**
 * Fills the calendar's "Alle" slot: the finished workouts of the other members of the
 * active group in the visible range (only what they share; the database decides).
 * Loads nothing while "Nur ich" is shown.
 */
export function useCalendarPeople(
  range: { from: Date; to: Date },
  enabled: boolean,
): CalendarPeople {
  const userId = useUserId();
  const { group } = useActiveGroup();
  const membersQuery = useGroupMembers(group.id);
  const members = membersQuery.data ?? [];
  const others = members.filter((member) => member.userId !== userId);
  const results = useQueries({
    queries: others.map((member) => ({
      ...workoutsInRangeOptions(userId, range, member.userId),
      enabled,
    })),
  });
  // Their plans (the range ends the day after its last day).
  const planRange = { from: range.from, to: new Date(range.to.getTime() - 24 * 60 * 60 * 1000) };
  const plans = useQueries({
    queries: others.map((member) => ({
      ...planOccurrencesOptions(userId, planRange, member.userId),
      enabled,
    })),
  });
  const me = members.find((member) => member.userId === userId);

  return {
    available: others.length > 0,
    ready: !membersQuery.isPending,
    myColor: me ? personColorVar(me.color) : null,
    myName: me?.displayName ?? null,
    people: others.map((member, index) => ({
      id: member.userId,
      name: member.displayName,
      color: personColorVar(member.color),
      workouts: results[index]?.data ?? [],
      plans: plans[index]?.data ?? [],
    })),
  };
}
