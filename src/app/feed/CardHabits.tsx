import type { FeedCard } from '@/features/feed';
import { useMemberLookup } from '@/features/groups';
import { HabitWeekReview } from '@/features/habits';
import { personColorVar } from '@/shared/design-tokens';

function field(data: unknown, key: string): unknown {
  return typeof data === 'object' && data !== null && !Array.isArray(data)
    ? (data as Record<string, unknown>)[key]
    : undefined;
}

/** Habits on a day card: Monday's look back at last week, and milestones. */
export function CardHabits({ card }: { card: FeedCard }) {
  const member = useMemberLookup(card.groupId)(card.actorId);
  const color = member ? personColorVar(member.color) : 'var(--color-accent)';
  const week = card.events.find((e) => e.type === 'habit_week');
  const weekStart = field(week?.data, 'weekStart');
  const milestones = card.events.flatMap((e) => {
    if (e.type !== 'habit_milestone') return [];
    const name = field(e.data, 'name');
    const count = field(e.data, 'milestone');
    const unit = field(e.data, 'unit');
    return typeof name === 'string' && typeof count === 'number'
      ? [
          {
            id: e.id,
            name,
            text: `${String(count)} ${unit === 'weeks' ? 'Wochen' : 'Tage'} drangeblieben`,
          },
        ]
      : [];
  });
  if (typeof weekStart !== 'string' && milestones.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {milestones.map((m) => (
        <p
          key={m.id}
          className="flex items-center gap-2 rounded-card bg-surface-2 px-4 py-3 text-subhead"
        >
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-pill"
            style={{ backgroundColor: color }}
          />
          <span className="min-w-0 flex-1 truncate font-semibold">{m.name}</span>
          <span className="shrink-0 text-text-muted">{m.text}</span>
        </p>
      ))}
      {typeof weekStart === 'string' && (
        <HabitWeekReview personId={card.actorId} weekStart={weekStart} color={color} />
      )}
    </div>
  );
}
