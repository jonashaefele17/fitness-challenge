import { motion } from 'motion/react';
import { Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router';
import { AppBadgeSync } from '@/features/notifications';
import { useActiveWorkout, WorkoutMiniBar } from '@/features/training';
import { fade } from '@/shared/design-tokens';
import { Toaster } from '@/shared/ui';
import { paths } from '../paths';
import { PillNav } from './PillNav';
import { PushTargetHandler } from './PushTargetHandler';
import { RealtimeSync } from './RealtimeSync';

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const fullScreen = location.pathname === paths.liveWorkout;
  const workoutRunning = Boolean(useActiveWorkout().data);

  return (
    <div className="min-h-dvh">
      <motion.main
        key={location.pathname}
        className={fullScreen ? undefined : 'pb-nav-clearance'}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={fade.base}
      >
        <Outlet />
        {/* Room for the mini bar of a running workout. */}
        {!fullScreen && workoutRunning && <div aria-hidden className="h-tap" />}
      </motion.main>
      {!fullScreen && (
        <PillNav
          top={
            workoutRunning ? (
              <WorkoutMiniBar onOpen={() => void navigate(paths.liveWorkout)} />
            ) : undefined
          }
        />
      )}
      <Toaster />
      {/* New tabs start at the top; going back restores the previous position. */}
      <ScrollRestoration />
      <AppBadgeSync />
      <RealtimeSync />
      <PushTargetHandler />
    </div>
  );
}
