import { cn } from '@/shared/lib';
import type { CalendarWorkout, PlanOccurrence } from '../../types';
import { TrainingTypeIcon } from '../TrainingTypeIcon';
import { cellLabel } from './workoutText';

/**
 * What was trained on a day: the leading icon (strength first) with a small second one,
 * "+n" beyond two, and a quiet grey label (focus short name, distance or duration).
 * Without a workout, what is planned: the icon faint (a star for an event), the time as
 * label; a cancelled date fainter still.
 */
export function DayMarks({
  workouts,
  plans = [],
}: {
  workouts: CalendarWorkout[];
  plans?: PlanOccurrence[] | undefined;
}) {
  const [first, second] = workouts;
  if (!first) {
    const plan =
      plans.find((p) => p.status === 'planned') ?? plans.find((p) => p.status === 'cancelled');
    if (!plan) return null;
    return (
      <span
        className={cn(
          'flex min-w-0 flex-col items-center gap-0.5',
          plan.status === 'cancelled' ? 'opacity-25' : 'opacity-60',
        )}
      >
        {plan.kind === 'event' ? (
          <span aria-hidden className="text-subhead leading-none">
            ★
          </span>
        ) : (
          <TrainingTypeIcon icon={plan.trainingType?.icon ?? 'generic'} className="size-5" />
        )}
        <span className="max-w-full truncate text-caption leading-none text-text-muted">
          {plan.startTime ?? ''}
        </span>
      </span>
    );
  }
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
