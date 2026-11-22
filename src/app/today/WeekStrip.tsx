import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useUserId } from '@/features/auth';
import { useThisWeek } from '@/features/habits';
import { TrainingTypeIcon, usePlanOccurrences, workoutsInRangeOptions } from '@/features/training';
import { cn } from '@/shared/lib';

const LETTERS = ['M', 'D', 'M', 'D', 'F', 'S', 'S'];

function mondayOf(date: Date): Date {
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

function sameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

/**
 * "Diese Woche": seven days with the trainings done (filled) and planned (outline, faded),
 * and weekly goals (e.g. Sport 2/4).
 */
export function WeekStrip() {
  const userId = useUserId();
  const [now] = useState(() => new Date());
  const monday = mondayOf(now);
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return day;
  });
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 7);
  const workouts =
    useQuery(workoutsInRangeOptions(userId, { from: monday, to: sunday })).data ?? [];
  const goals = useThisWeek();
  // Planned dates of the week (the range ends on its last day).
  const lastDay = new Date(sunday);
  lastDay.setDate(sunday.getDate() - 1);
  const [planRange] = useState(() => ({ from: monday, to: lastDay }));
  const plans = (usePlanOccurrences(planRange).data ?? []).filter((p) => p.status === 'planned');

  return (
    <section className="flex flex-col gap-3 rounded-card bg-surface-2 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-body font-semibold">Diese Woche</h2>
        <span className="flex gap-3 text-footnote">
          {goals.map((goal) => (
            <span
              key={goal.name}
              className={cn(
                'font-semibold tabular-nums',
                goal.state === 'done' ? 'text-accent' : 'text-text-muted',
              )}
            >
              {goal.name} {goal.doneDays}/{goal.target}
            </span>
          ))}
        </span>
      </div>
      <ol className="grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          const done = workouts.filter((w) => sameDay(new Date(w.startedAt), day));
          const first = done[0];
          const planned = first
            ? undefined
            : plans.find((p) => sameDay(new Date(`${p.onDate}T12:00:00`), day));
          const today = sameDay(day, now);
          return (
            <li key={day.toISOString()} className="flex flex-col items-center gap-1">
              <span className={cn('text-caption', today ? 'text-accent' : 'text-text-muted')}>
                {LETTERS[index]}
              </span>
              <span
                className={cn(
                  'flex size-9 items-center justify-center rounded-pill text-footnote tabular-nums',
                  first ? 'bg-accent text-on-accent' : 'bg-surface-3 text-text-subtle',
                  planned && 'text-accent',
                  today && !first && 'ring-2 ring-accent',
                )}
              >
                {first ? (
                  <TrainingTypeIcon
                    icon={first.trainingType.icon}
                    variant="filled"
                    className="size-5"
                  />
                ) : planned ? (
                  // Planned: the outline icon, faded (as in the calendar).
                  <span className="flex opacity-55">
                    {planned.kind === 'event' ? (
                      <span aria-hidden>★</span>
                    ) : (
                      <TrainingTypeIcon
                        icon={planned.trainingType?.icon ?? 'generic'}
                        className="size-5"
                      />
                    )}
                  </span>
                ) : (
                  day.getDate()
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
