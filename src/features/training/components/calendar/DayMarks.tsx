import type { CalendarWorkout } from '../../types';
import { TrainingTypeIcon } from '../TrainingTypeIcon';
import { cellLabel } from './workoutText';

/**
 * What was trained on a day: the leading icon (strength first) with a small second one,
 * "+n" beyond two, and a quiet grey label (focus short name, distance or duration).
 */
export function DayMarks({ workouts }: { workouts: CalendarWorkout[] }) {
  const [first, second] = workouts;
  if (!first) return null;
  const label = cellLabel(first) || (workouts.length > 1 ? `${String(workouts.length)}×` : '');
  return (
    <span className="flex min-w-0 flex-col items-center gap-0.5">
      <span className="flex items-center gap-0.5">
        <TrainingTypeIcon icon={first.trainingType.icon} className={second ? 'size-4' : 'size-5'} />
        {second && (
          <TrainingTypeIcon icon={second.trainingType.icon} className="size-3 opacity-70" />
        )}
        {workouts.length > 2 && (
          <span className="text-caption leading-none">+{workouts.length - 2}</span>
        )}
      </span>
      <span className="max-w-full truncate text-caption leading-none text-text-muted">{label}</span>
    </span>
  );
}
