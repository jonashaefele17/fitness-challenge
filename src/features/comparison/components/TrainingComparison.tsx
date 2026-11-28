import { Avatar } from '@/features/profile';
import { LineChart } from '@/shared/ui';
import { useGroupTrainingDays } from '../api/useGroupTrainingDays';

const daysText = (count: number) => (count === 1 ? '1 Tag' : `${String(count)} Tage`);
const countText = (value: number) => String(Math.round(value));

/**
 * Vergleich → Trainings: the training days of everyone from `from` to `to`, summed up day by
 * day (a line each in their colour), and a row per person below with the number of days.
 * Fixed order, me first – no ranking.
 */
export function TrainingComparison({ from, to }: { from: string; to: string }) {
  const { people, isPending } = useGroupTrainingDays(from, to);

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-card bg-surface-2 p-4">
        {isPending ? (
          <div className="h-chart" aria-hidden />
        ) : (
          <LineChart
            key={`${from}/${to}`}
            series={people.map((person) => ({
              key: person.id,
              name: person.name,
              color: person.color,
              points: person.points,
            }))}
            axis="count"
            label="Trainingstage, aufsummiert"
            formatValue={(point) => countText(point.value)}
            formatAxis={countText}
            zeroLabel="0"
          />
        )}
      </section>
      <ul className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
        {people.map((person) => (
          <li key={person.id} className="flex min-h-tap items-center gap-3 px-4 py-2">
            <Avatar profile={person.member} size="sm" />
            <span className="min-w-0 flex-1 truncate text-subhead font-semibold">
              {person.name}
            </span>
            <span className="text-subhead font-semibold tabular-nums">
              {daysText(person.count)}
            </span>
          </li>
        ))}
      </ul>
      <p className="px-1 text-footnote text-text-muted">
        Trainingstage seit Beginn des Zeitraums · ein Tag zählt einmal
      </p>
    </div>
  );
}
