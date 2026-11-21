import { showToast } from '@/shared/lib';
import { useUnlinkExercise } from '../../api/usePlaces';
import type { Device, ExerciseSummary } from '../../types';

/**
 * After linking an exercise to a device type: a toast with "Rückgängig", so a mis-tap does
 * not stay in the shared catalogue. Only for links that are new.
 */
export function useLinkUndo() {
  const unlink = useUnlinkExercise();
  return (isNew: boolean, exercise: Pick<ExerciseSummary, 'id' | 'name'>, device: Device) => {
    if (!isNew) return;
    showToast(`${exercise.name} gehört jetzt zu ${device.name}.`, {
      label: 'Rückgängig',
      onAction: () => {
        unlink.mutate({ typeId: device.typeId, exerciseId: exercise.id });
      },
    });
  };
}
