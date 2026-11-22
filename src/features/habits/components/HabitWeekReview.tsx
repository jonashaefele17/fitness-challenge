import { useHabitSummary, useHabitWeeks, useMyHabits } from '../api/useHabits';
import { addDays } from '../dates';

/**
 * Someone's week with their shared habits (feed card): a line per habit with how often
 * it was met and a bar in their colour. Asks the database, so it follows the current sharing.
 */
export function HabitWeekReview({
  personId,
  weekStart,
  color,
}: {
  personId: string;
  weekStart: string;
  /** CSS colour of the person. */
  color: string;
}) {
  const end = addDays(weekStart, 6);
  const habits = (useMyHabits(personId).data ?? []).filter(
    (h) => !h.archived && h.shareLevel !== 'private',
  );
  const summaries = useHabitSummary(weekStart, end, personId).data ?? [];
  const weeks = useHabitWeeks(weekStart, end, personId).data ?? [];
  const lines = habits.flatMap((habit) => {
    if (habit.current.frequency === 'weekly') {
      const week = weeks.find((w) => w.habitId === habit.id);
      if (!week || week.target === 0) return [];
      return [{ habit, met: week.doneDays, of: week.target }];
    }
    const s = summaries.find((x) => x.habitId === habit.id);
    if (!s || s.counted === 0) return [];
    return [{ habit, met: s.met, of: s.counted }];
  });
  if (lines.length === 0) return null;
  return (
    <section className="flex flex-col gap-2 rounded-card bg-surface-2 px-4 py-3">
      <h3 className="text-footnote font-semibold text-text-muted">Habits letzte Woche</h3>
      <ul className="flex flex-col gap-2">
        {lines.map(({ habit, met, of }) => (
          <li key={habit.id} className="flex items-center gap-3">
            <span className="min-w-0 flex-1 truncate text-subhead">{habit.current.name}</span>
            <span className="h-1 w-16 overflow-hidden rounded-pill bg-surface-3">
              <span
                className="block h-full rounded-pill"
                style={{
                  width: `${String(Math.round(Math.min(1, met / of) * 100))}%`,
                  backgroundColor: color,
                }}
              />
            </span>
            <span className="w-10 text-right text-footnote font-semibold tabular-nums">
              {met}/{of}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
