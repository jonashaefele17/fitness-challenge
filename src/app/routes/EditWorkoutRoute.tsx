import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { SplashScreen, useUserId } from '@/features/auth';
import {
  editKey,
  useEditableWorkout,
  WorkoutCacheContext,
  WorkoutScreen,
} from '@/features/training';
import { paths } from '../paths';

/** One of my finished workouts in the workout screen (edit mode), full screen. */
export function EditWorkoutRoute() {
  const { workoutId = '' } = useParams();
  const userId = useUserId();
  const workout = useEditableWorkout(workoutId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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
      <WorkoutScreen workout={workout.data} mode="edit" onMinimize={close} onClose={close} />
    </WorkoutCacheContext.Provider>
  );
}
