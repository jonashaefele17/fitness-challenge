import { useUserId } from '@/features/auth';
import { useActiveGroup, useGroupMembers } from '@/features/groups';
import {
  habitKey,
  useHabitsOfPeople,
  type Habit,
  type HabitCompare,
  type HabitPerson,
} from '@/features/habits';
import { personColorVar } from '@/shared/design-tokens';

export interface GroupHabitRow {
  key: string;
  name: string;
  /** One per column (person); null: doesn't keep it or doesn't share it. */
  cells: (HabitPerson | null)[];
}

/**
 * The active group's shared habits as a matrix: a column per person (me first), a row per
 * habit (same standard template, or taken over from the same one). Habits more people keep
 * come first. What is private never arrives (the database decides).
 */
export function useGroupHabits() {
  const userId = useUserId();
  const { group } = useActiveGroup();
  const members = useGroupMembers(group.id).data ?? [];
  const ordered = [
    ...members.filter((m) => m.userId === userId),
    ...members.filter((m) => m.userId !== userId),
  ];
  const lists = useHabitsOfPeople(ordered.map((m) => m.userId));
  const columns = ordered.map((m) => ({
    id: m.userId,
    name: m.userId === userId ? 'Du' : m.displayName,
    color: personColorVar(m.color),
  }));

  const rows = new Map<string, GroupHabitRow>();
  lists.forEach(({ habits }, index) => {
    const column = columns[index];
    if (!column) return;
    habits
      .filter((h: Habit) => !h.archived && h.shareLevel !== 'private')
      .forEach((habit) => {
        const key = habitKey(habit);
        const row = rows.get(key) ?? {
          key,
          name: habit.current.name,
          cells: columns.map(() => null),
        };
        row.cells[index] = { ...column, habit };
        rows.set(key, row);
      });
  });
  const count = (row: GroupHabitRow) => row.cells.filter(Boolean).length;
  return {
    columns,
    rows: [...rows.values()].sort(
      (a, b) => count(b) - count(a) || a.name.localeCompare(b.name, 'de'),
    ),
  };
}

/**
 * Fills the habits' comparison slot: the others in the active group who keep the same habit
 * and share it, each in their person colour.
 */
export function useHabitCompare(habit: Habit | null): HabitCompare {
  const userId = useUserId();
  const { group } = useActiveGroup();
  const members = useGroupMembers(group.id).data ?? [];
  const others = members.filter((m) => m.userId !== userId);
  const lists = useHabitsOfPeople(habit ? others.map((m) => m.userId) : []);
  const me = members.find((m) => m.userId === userId);
  if (!habit || !me) return { me: null, people: [] };
  const key = habitKey(habit);
  return {
    me: { id: me.userId, name: 'Du', color: personColorVar(me.color) },
    people: lists.flatMap(({ personId, habits }) => {
      const member = others.find((m) => m.userId === personId);
      const same = habits.find(
        (h) => !h.archived && h.shareLevel !== 'private' && habitKey(h) === key,
      );
      return member && same
        ? [
            {
              id: member.userId,
              name: member.displayName,
              color: personColorVar(member.color),
              habit: same,
            },
          ]
        : [];
    }),
  };
}
