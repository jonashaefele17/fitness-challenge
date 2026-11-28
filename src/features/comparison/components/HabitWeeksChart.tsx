import { useUserId } from '@/features/auth';
import { useActiveGroup, useGroupMembers } from '@/features/groups';
import { personColorVar } from '@/shared/design-tokens';
import { LineChart } from '@/shared/ui';
import { habitWeekLines, type HabitWeek } from '../chart';

const pctText = (value: number) => `${String(Math.round(value))} %`;

/**
 * Vergleich → Habits, above the matrix: the habit quota per calendar week, a line per
 * person in their colour (me first), 0 … 100 %. Which habits the weeks are over is the
 * caller's (shared habits from useGroupHabitWeeks, or the season's habits from the app);
 * `note` says it under the chart.
 */
export function HabitWeeksChart({
  weeks,
  isPending,
  note,
}: {
  weeks: readonly HabitWeek[];
  isPending: boolean;
  note: string;
}) {
  const userId = useUserId();
  const { group } = useActiveGroup();
  const members = useGroupMembers(group.id).data ?? [];
  const people = [
    ...members.filter((m) => m.userId === userId),
    ...members.filter((m) => m.userId !== userId),
  ].map((m) => ({
    userId: m.userId,
    name: m.userId === userId ? 'Du' : m.displayName,
    color: personColorVar(m.color),
  }));
  const lines = habitWeekLines(weeks, people);

  return (
    <div className="flex flex-col gap-2">
      <section className="flex flex-col gap-3 rounded-card bg-surface-2 p-4">
        <h3 className="text-subhead font-semibold">Quote pro Woche</h3>
        {isPending ? (
          <div className="h-chart" aria-hidden />
        ) : lines.length === 0 ? (
          <p className="text-footnote text-text-muted">Noch keine Woche, in der etwas zählt.</p>
        ) : (
          <LineChart
            series={lines}
            axis="progress"
            label="Habit-Quote pro Woche"
            formatValue={(point) => pctText(point.value)}
            formatAxis={pctText}
            zeroLabel="0 %"
          />
        )}
      </section>
      <p className="px-1 text-footnote text-text-muted">{note}</p>
    </div>
  );
}
