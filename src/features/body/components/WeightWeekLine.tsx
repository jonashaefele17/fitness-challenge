import { useWeightWeek } from '../api/useWeight';
import { weightWeekParts } from '../format';

/**
 * Someone's weight last week (feed card, Monday): one quiet line with the change of the
 * week and of the 4 weeks ending with it. Asks the database, so it follows the current
 * sharing: nothing at all when the person does not share (any longer) or the data is gone.
 */
export function WeightWeekLine({
  personId,
  weekStart,
  color,
}: {
  personId: string;
  weekStart: string;
  /** CSS colour of the person. */
  color: string;
}) {
  const week = useWeightWeek(weekStart, personId).data;
  const parts = week ? weightWeekParts(week) : [];
  if (parts.length === 0) return null;
  return (
    <p className="flex items-start gap-2 rounded-card bg-surface-2 px-4 py-3 text-subhead">
      <span
        aria-hidden
        className="mt-1.5 size-2 shrink-0 rounded-pill"
        style={{ backgroundColor: color }}
      />
      <span className="min-w-0 flex-1 tabular-nums">
        <span className="font-semibold">Gewicht</span>
        {parts.map((part) => (
          <span key={part} className="text-text-muted">
            {' · '}
            <span className="whitespace-nowrap">{part}</span>
          </span>
        ))}
      </span>
    </p>
  );
}
