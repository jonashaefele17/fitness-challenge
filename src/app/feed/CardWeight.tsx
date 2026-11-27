import { WeightWeekLine } from '@/features/body';
import type { FeedCard } from '@/features/feed';
import { useMemberLookup } from '@/features/groups';
import { personColorVar } from '@/shared/design-tokens';

function field(data: unknown, key: string): unknown {
  return typeof data === 'object' && data !== null && !Array.isArray(data)
    ? (data as Record<string, unknown>)[key]
    : undefined;
}

/** Weight on a day card: Monday's look back at last week (only if shared). */
export function CardWeight({ card }: { card: FeedCard }) {
  const member = useMemberLookup(card.groupId)(card.actorId);
  const color = member ? personColorVar(member.color) : 'var(--color-accent)';
  const weekStart = field(card.events.find((e) => e.type === 'weight_week')?.data, 'weekStart');
  if (typeof weekStart !== 'string') return null;
  return <WeightWeekLine personId={card.actorId} weekStart={weekStart} color={color} />;
}
