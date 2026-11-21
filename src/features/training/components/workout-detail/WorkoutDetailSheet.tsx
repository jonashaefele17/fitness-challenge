import { Sheet } from '@/shared/ui';
import { useWorkoutDetail } from '../../api/useCalendar';
import { WorkoutDetail, type WorkoutFocus } from './WorkoutDetail';

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
  return (
    <Sheet
      open={workoutId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={workout ? workout.trainingType.name : 'Training'}
      className="min-h-sheet-min"
    >
      {workout ? (
        <WorkoutDetail key={workout.id} workout={workout} focus={focus ?? null} />
      ) : detail.isError ? (
        <p className="text-subhead text-text-muted">Das Training konnte nicht geladen werden.</p>
      ) : null}
    </Sheet>
  );
}
