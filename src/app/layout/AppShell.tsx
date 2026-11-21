import { motion } from 'motion/react';
import { Outlet, ScrollRestoration, useLocation } from 'react-router';
import { AppBadgeSync } from '@/features/notifications';
import { fade } from '@/shared/design-tokens';
import { PillNav } from './PillNav';
import { RealtimeSync } from './RealtimeSync';

export function AppShell() {
  const location = useLocation();

  return (
    <div className="min-h-dvh">
      <motion.main
        key={location.pathname}
        className="pb-nav-clearance"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={fade.base}
      >
        <Outlet />
      </motion.main>
      <PillNav />
      {/* New tabs start at the top; going back restores the previous position. */}
      <ScrollRestoration />
      <AppBadgeSync />
      <RealtimeSync />
    </div>
  );
}
