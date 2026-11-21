import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { SplashScreen, useUserId } from '@/features/auth';
import {
  editKey,
  useEditableWorkout,
  WorkoutCacheContext,
  WorkoutScreen,
  type ActiveWorkout,
} from '@/features/training';
import { paths } from '../paths';

/** One of my finished workouts in the workout screen (edit mode), full screen. */
export function EditWorkoutRoute() {
  const { workoutId = '' } = useParams();
  const userId = useUserId();
  const workout = useEditableWorkout(workoutId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // The state when editing began, for "Änderungen verwerfen" (kept for this visit).
  const [snapshot, setSnapshot] = useState<ActiveWorkout | null>(null);
  if (workout.data && !snapshot) setSnapshot(workout.data);

  // Edits went to the edit cache: refresh everything that shows workouts when leaving
  // (calendar, detail, feed cards).
  useEffect(
    () => () => {
      void queryClient.invalidateQueries();
    },
    [queryClient],
  );

  if (workout.isPending) return <SplashScreen />;
  if (!workout.data) return <Navigate to={paths.training} replace />;

  const close = () => {
    if (window.history.length > 1) void navigate(-1);
    else void navigate(paths.training, { replace: true });
  };

  return (
    <WorkoutCacheContext.Provider value={editKey(userId, workoutId)}>
      <WorkoutScreen
        workout={workout.data}
        mode="edit"
        snapshot={snapshot ?? undefined}
        onMinimize={close}
        onClose={close}
      />
    </WorkoutCacheContext.Provider>
  );
}
