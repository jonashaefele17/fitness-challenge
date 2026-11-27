import { useQueries } from '@tanstack/react-query';
import { useUserId } from '@/features/auth';
import {
  periodRange,
  useBodySettings,
  weightProgressOptions,
  type WeightProgressDay,
  type WeightShare,
} from '@/features/body';
import { useActiveGroup, useGroupMembers, type GroupMember } from '@/features/groups';
import { personColorVar } from '@/shared/design-tokens';

/** Gruppe → Gewicht: 4 Wochen / 3 Monate / 1 Jahr. */
export type WeightComparePeriod = '4w' | '3m' | '1y';

export interface WeightPerson {
  id: string;
  member: GroupMember;
  /** "Du" for me. */
  name: string;
  /** CSS colour of the person. */
  color: string;
  /** Days with entries in the period, oldest first; changePct against the first. */
  days: WeightProgressDay[];
  /** Change over the period, in %. */
  changePct: number;
  /** Current 7-day trend in kg; null unless the person shares kg (me too: as others see me). */
  trendKg: number | null;
}

/**
 * The weight lines of the active group in a period: me first, then the others, each only
 * if they share their weight and weighed in the period. I see myself as the others see me:
 * not at all with "Nur ich", without kg with "Nur %". The database leaves out what others
 * do not share.
 */
export function useGroupWeight(period: WeightComparePeriod, today: string) {
  const userId = useUserId();
  const { group } = useActiveGroup();
  const members = useGroupMembers(group.id);
  const settings = useBodySettings();
  const myShare: WeightShare | null = settings.data?.weightShare ?? null;
  const ordered = [
    ...(members.data ?? []).filter((m) => m.userId === userId),
    ...(members.data ?? []).filter((m) => m.userId !== userId),
  ];
  const { from, to } = periodRange(period, today);
  const curves = useQueries({
    queries: ordered.map((m) => weightProgressOptions(userId, m.userId, from, to)),
  });

  const people = ordered.flatMap((member, index): WeightPerson[] => {
    const days = curves[index]?.data ?? [];
    const last = days.at(-1);
    const me = member.userId === userId;
    if (!last || (me && myShare !== 'percent' && myShare !== 'kg')) return [];
    const showKg = me ? myShare === 'kg' : last.trendKg !== null;
    return [
      {
        id: member.userId,
        member,
        name: me ? 'Du' : member.displayName,
        color: personColorVar(member.color),
        days: showKg ? days : days.map((d) => ({ ...d, trendKg: null })),
        changePct: last.changePct,
        trendKg: showKg ? last.trendKg : null,
      },
    ];
  });

  return {
    people,
    myShare,
    isPending: members.isPending || settings.isPending || curves.some((c) => c.isPending),
  };
}
