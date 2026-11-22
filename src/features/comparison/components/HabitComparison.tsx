import { useUserId } from '@/features/auth';
import { useActiveGroup, useGroupMembers, type GroupMember } from '@/features/groups';
import { HabitCompareRow, useHabitsOfPeople, type Habit } from '@/features/habits';
import { personColorVar } from '@/shared/design-tokens';

interface Entry {
  habit: Habit;
  member: GroupMember;
}

/**
 * The group's habits side by side, grouped by habit: everyone who keeps the same one
 * (same standard template, or taken over from the same person) in one card.
 * Only shared habits appear; the database hides the rest anyway.
 */
export function HabitComparison() {
  const userId = useUserId();
  const { group } = useActiveGroup();
  const members = useGroupMembers(group.id).data ?? [];
  const lists = useHabitsOfPeople(members.map((m) => m.userId));

  const groups = new Map<string, Entry[]>();
  lists.forEach(({ personId, habits }) => {
    const member = members.find((m) => m.userId === personId);
    if (!member) return;
    habits
      .filter((h) => !h.archived && h.shareLevel !== 'private')
      .forEach((habit) => {
        const key = habit.templateId ?? habit.sourceHabitId ?? habit.id;
        groups.set(key, [...(groups.get(key) ?? []), { habit, member }]);
      });
  });
  // Mine first within a habit; shared habits (2+ people) before single ones.
  const cards = [...groups.values()]
    .map((entries) =>
      entries.sort((a, b) =>
        a.member.userId === userId ? -1 : b.member.userId === userId ? 1 : 0,
      ),
    )
    .sort(
      (a, b) =>
        Number(b.length > 1) - Number(a.length > 1) ||
        (a[0]?.habit.current.name ?? '').localeCompare(b[0]?.habit.current.name ?? '', 'de'),
    );

  if (cards.length === 0) {
    return (
      <p className="rounded-card bg-surface-2 px-4 py-6 text-center text-subhead text-text-muted">
        Noch keine geteilten Habits. Teilen geht beim Habit unter „Wer sieht das?“.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="px-1 text-footnote text-text-muted">
        Kästchen: letzte 7 Tage · Prozent: letzte 4 Wochen
      </p>
      {cards.map((entries) => {
        const first = entries[0];
        if (!first) return null;
        const alone = entries.length === 1;
        return (
          <section
            key={first.habit.id}
            className="flex flex-col gap-3 rounded-card bg-surface-2 px-4 py-3"
          >
            <h3 className="text-subhead font-semibold">
              {first.habit.current.name}
              {alone && (
                <span className="font-normal text-text-muted">
                  {' '}
                  · nur {first.member.userId === userId ? 'du' : first.member.displayName}
                </span>
              )}
            </h3>
            {entries.map(({ habit, member }) => (
              <HabitCompareRow
                key={habit.id}
                habit={habit}
                label={member.userId === userId ? 'Du' : member.displayName}
                color={personColorVar(member.color)}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}
