import { useQueries } from '@tanstack/react-query';
import { useState } from 'react';
import { useUserId } from '@/features/auth';
import { HabitCompareSheet, habitSummaryOptions, type HabitPerson } from '@/features/habits';
import { CompareTable } from '@/shared/ui';
import { useGroupHabits } from '../api/useGroupHabits';

function dayKey(date: Date): string {
  return `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Gruppe → Habits: a row per shared habit, a column per person with the share of the last
 * 4 weeks (bar in their colour). A tap opens the habit compared side by side.
 */
export function HabitComparison() {
  const userId = useUserId();
  const { columns, rows } = useGroupHabits();
  const [range] = useState(() => {
    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - 27);
    return { from: dayKey(from), to: dayKey(today) };
  });
  const summaries = useQueries({
    queries: columns.map((c) => habitSummaryOptions(userId, range.from, range.to, c.id)),
  });
  const [open, setOpen] = useState<{ title: string; people: HabitPerson[] } | null>(null);

  if (rows.length === 0) {
    return (
      <p className="rounded-card bg-surface-2 px-4 py-6 text-center text-subhead text-text-muted">
        Noch keine geteilten Habits. Teilen geht beim Habit unter „Wer sieht das?“.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <CompareTable
        columns={columns.map((c) => ({ key: c.id, label: c.name, color: c.color }))}
        rows={rows.map((row) => ({
          key: row.key,
          label: row.name,
          cells: row.cells.map((cell, index) => {
            if (!cell) return null;
            const quota =
              summaries[index]?.data?.find((s) => s.habitId === cell.habit.id)?.quota ?? null;
            return {
              value: quota === null ? '–' : `${String(Math.round(quota * 100))} %`,
              fraction: quota,
            };
          }),
          onOpen: () => {
            setOpen({ title: row.name, people: row.cells.filter((c) => c !== null) });
          },
        }))}
      />
      <p className="px-1 text-footnote text-text-muted">Prozent: letzte 4 Wochen</p>
      <HabitCompareSheet
        title={open?.title ?? ''}
        people={open?.people ?? null}
        onClose={() => {
          setOpen(null);
        }}
      />
    </div>
  );
}
