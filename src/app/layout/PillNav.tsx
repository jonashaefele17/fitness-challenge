import { motion } from 'motion/react';
import type { ComponentType, ReactNode, SVGProps } from 'react';
import { NavLink } from 'react-router';
import { pressScale, spring } from '@/shared/design-tokens';
import { cn } from '@/shared/lib';
import { GroupIcon, MeIcon, TodayIcon, TrainingIcon } from '@/shared/ui';
import { paths } from '../paths';
import { StartButton } from './StartButton';

interface Tab {
  to: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const tabs: Tab[] = [
  { to: paths.today, label: 'Heute', Icon: TodayIcon },
  { to: paths.training, label: 'Training', Icon: TrainingIcon },
  { to: paths.group, label: 'Gruppe', Icon: GroupIcon },
  { to: paths.me, label: 'Ich', Icon: MeIcon },
];

/** Floating pill navigation with the round start button next to it. */
export function PillNav({ top }: { top?: ReactNode }) {
  return (
    // layoutRoot: the bar is position: fixed, so the active-tab lens must be measured relative
    // to it, not to the scrolled page (otherwise it flies in from below after scrolling).
    <motion.div
      layoutRoot
      className="pointer-events-none fixed inset-x-0 bottom-safe z-30 flex flex-col gap-2 px-gutter"
    >
      {top}
      <div className="flex items-center gap-3">
        <nav
          aria-label="Hauptnavigation"
          className="pointer-events-auto flex h-nav flex-1 items-center rounded-pill glass p-1"
        >
          {tabs.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'relative flex h-full flex-1 rounded-pill text-caption font-medium transition-colors duration-(--duration-fast)',
                  isActive ? 'text-accent' : 'text-text-muted',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="pill-nav-lens"
                      className="absolute inset-0 rounded-pill glass-lens"
                      transition={spring.snappy}
                    />
                  )}
                  <motion.span
                    className="relative flex flex-1 flex-col items-center justify-center gap-0.5"
                    whileTap={{ scale: pressScale }}
                    transition={spring.press}
                  >
                    <Icon className="text-title-3" />
                    <span>{label}</span>
                  </motion.span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <StartButton />
      </div>
    </motion.div>
  );
}
