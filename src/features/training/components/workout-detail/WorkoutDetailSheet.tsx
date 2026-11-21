import { Sheet } from '@/shared/ui';
import { useWorkoutDetail } from '../../api/useCalendar';
import { WorkoutDetail } from './WorkoutDetail';

/** Detail of a finished workout (mine or a group mate's I may see). */
export function WorkoutDetailSheet({
  workoutId,
  onClose,
}: {
  workoutId: string | null;
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
        <WorkoutDetail key={workout.id} workout={workout} />
      ) : detail.isError ? (
        <p className="text-subhead text-text-muted">Das Training konnte nicht geladen werden.</p>
      ) : null}
    </Sheet>
  );
}
