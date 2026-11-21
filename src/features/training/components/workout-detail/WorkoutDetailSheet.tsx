import { useContext } from 'react';
import { useUserId } from '@/features/auth';
import { Sheet } from '@/shared/ui';
import { useWorkoutDetail } from '../../api/useCalendar';
import { WorkoutDetail, type WorkoutFocus } from './WorkoutDetail';
import { WorkoutEditContext } from './edit';

/** Detail of a finished workout (mine or a group mate's I may see). */
export function WorkoutDetailSheet({
  workoutId,
  focus,
  onClose,
}: {
  workoutId: string | null;
  /** Exercise (and set) to scroll to and mark, e.g. from a notification. */
  focus?: WorkoutFocus | null | undefined;
  onClose: () => void;
}) {
  const detail = useWorkoutDetail(workoutId);
  const workout = detail.data;
  const editWorkout = useContext(WorkoutEditContext);
  const mine = workout?.userId === useUserId();
  return (
    <Sheet
      open={workoutId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={workout ? workout.trainingType.name : 'Training'}
      className="min-h-sheet-min"
      action={
        workout && mine && editWorkout ? (
          <button
            type="button"
            onClick={() => {
              editWorkout(workout.id);
            }}
            className="flex min-h-tap items-center rounded-pill px-3 text-subhead font-semibold text-accent active:bg-surface-2"
          >
            Bearbeiten
          </button>
        ) : undefined
      }
    >
      {workout ? (
        <WorkoutDetail key={workout.id} workout={workout} focus={focus ?? null} />
      ) : detail.isError ? (
        <p className="text-subhead text-text-muted">Das Training konnte nicht geladen werden.</p>
      ) : null}
    </Sheet>
  );
}
