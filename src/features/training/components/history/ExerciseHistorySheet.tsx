import { Sheet } from '@/shared/ui';
import type { Device, ExerciseSummary } from '../../types';
import { ExerciseHistory } from './ExerciseHistory';

export interface HistoryTarget {
  exercise: ExerciseSummary;
  device: Device | null;
}

export function ExerciseHistorySheet({
  target,
  onClose,
}: {
  target: HistoryTarget | null;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={target?.exercise.name ?? 'Verlauf'}
      {...(target?.device &&
        target.device.name !== target.exercise.name && { description: target.device.name })}
      className="min-h-sheet-min"
    >
      {target && (
        <ExerciseHistory
          key={`${target.exercise.id}:${target.device?.id ?? ''}`}
          exercise={target.exercise}
          device={target.device}
        />
      )}
    </Sheet>
  );
}
