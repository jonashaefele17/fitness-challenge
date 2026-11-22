import { ChevronRightIcon } from '@/shared/ui';
import type { CalendarWorkout } from '../../types';
import { TrainingTypeIcon } from '../TrainingTypeIcon';
import type { LogRow } from './logData';
import { workoutSubtitle, workoutTitle } from './workoutText';

/** The workouts of one day (of everyone shown), each opening its detail. */
export function DayList({
  entries,
  showNames,
  onOpen,
}: {
  entries: { row: LogRow; workout: CalendarWorkout }[];
  showNames: boolean;
  onOpen: (workoutId: string) => void;
}) {
  if (entries.length === 0) {
    return <p className="text-footnote text-text-subtle">Kein Training.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {entries.map(({ row, workout }) => (
        <li key={workout.id}>
          <button
            type="button"
            onClick={() => {
              onOpen(workout.id);
            }}
            className="flex min-h-tap w-full items-center gap-3 rounded-card bg-surface-2 px-4 py-3 text-left active:bg-surface-3"
          >
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-surface-3"
              style={{ color: row.color }}
            >
              <TrainingTypeIcon
                icon={workout.trainingType.icon}
                variant="filled"
                className="size-5"
              />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-subhead font-semibold">
                {showNames && <span className="text-text-muted">{row.name} · </span>}
                {workoutTitle(workout)}
              </span>
              <span className="truncate text-footnote text-text-muted">
                {workoutSubtitle(workout)}
              </span>
            </span>
            <ChevronRightIcon aria-hidden className="shrink-0 text-text-subtle" />
          </button>
        </li>
      ))}
    </ul>
  );
}
