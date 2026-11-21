import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { SplashScreen } from '@/features/auth';
import { useActiveWorkout, WorkoutScreen, type ActiveWorkout } from '@/features/training';
import { paths } from '../paths';

/** Full-screen running workout (no tab bar). */
export function LiveWorkoutRoute() {
  const active = useActiveWorkout();
  const navigate = useNavigate();
  // Keep showing the last state after finishing, so the summary can stay open.
  const [retained, setRetained] = useState<ActiveWorkout | null>(null);
  if (active.data && active.data !== retained) setRetained(active.data);

  if (active.isPending) return <SplashScreen />;
  const workout = active.data ?? retained;
  if (!workout) return <Navigate to={paths.training} replace />;

  return (
    <WorkoutScreen
      workout={workout}
      onMinimize={() => void navigate(paths.training)}
      onClose={() => void navigate(paths.training, { replace: true })}
    />
  );
}
