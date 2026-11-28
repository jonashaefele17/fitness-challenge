import { useQuery } from '@tanstack/react-query';
import { useUserId } from '@/features/auth';
import { useActiveGroup, useGroupMembers, type GroupMember } from '@/features/groups';
import { personColorVar } from '@/shared/design-tokens';
import { supabase } from '@/shared/lib/supabase';
import { cumulativeDays } from '../chart';

export interface TrainingPerson {
  id: string;
  member: GroupMember;
  /** "Du" for me. */
  name: string;
  /** CSS colour of the person. */
  color: string;
  /** Training days in the period. */
  count: number;
  /** Training days summed up, a point per day of the period. */
  points: { onDate: string; value: number }[];
}

/**
 * The training days of the active group's members from `from` to `to` (local days in my
 * time zone; a day counts once): me first, then the others in member order. Whose trainings
 * I may not see does not arrive (the database decides).
 */
export function useGroupTrainingDays(from: string, to: string) {
  const userId = useUserId();
  const { group } = useActiveGroup();
  const members = useGroupMembers(group.id);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const days = useQuery({
    queryKey: ['comparison', 'trainingDays', group.id, from, to, timeZone],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('group_training_days', {
        p_group_id: group.id,
        p_from: from,
        p_to: to,
        p_time_zone: timeZone,
      });
      if (error) throw error;
      return data;
    },
  });

  const all = members.data ?? [];
  const ordered = [
    ...all.filter((m) => m.userId === userId),
    ...all.filter((m) => m.userId !== userId),
  ];
  const people = ordered.map((member): TrainingPerson => {
    const mine = (days.data ?? []).filter((d) => d.user_id === member.userId);
    const points = cumulativeDays(
      from,
      to,
      mine.map((d) => d.on_date),
    );
    return {
      id: member.userId,
      member,
      name: member.userId === userId ? 'Du' : member.displayName,
      color: personColorVar(member.color),
      count: points.at(-1)?.value ?? 0,
      points,
    };
  });

  return { people, isPending: members.isPending || days.isPending };
}
