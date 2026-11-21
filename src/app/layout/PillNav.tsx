import { motion } from 'motion/react';
import type { ComponentType, ReactNode, SVGProps } from 'react';
import { NavLink, useLocation } from 'react-router';
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
  const { pathname } = useLocation();
  const index = tabs.findIndex((tab) => pathname === tab.to || pathname.startsWith(`${tab.to}/`));
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-safe z-30 flex flex-col gap-2 px-gutter">
      {top}
      <div className="flex items-center gap-3">
        <nav
          aria-label="Hauptnavigation"
          className="pointer-events-auto relative flex h-nav flex-1 items-center rounded-pill glass p-1"
        >
          {/* One lens slid inside the bar (no layout animation: those measure the viewport
              and fly in from below after scrolling). */}
          {index >= 0 && (
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-y-1 left-1 rounded-pill glass-lens"
              style={{ width: `calc((100% - 2 * var(--spacing)) / ${String(tabs.length)})` }}
              initial={false}
              animate={{ x: `${String(index * 100)}%` }}
              transition={spring.snappy}
            />
          )}
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
              <motion.span
                className="relative flex flex-1 flex-col items-center justify-center gap-0.5"
                whileTap={{ scale: pressScale }}
                transition={spring.press}
              >
                <Icon className="text-title-3" />
                <span>{label}</span>
              </motion.span>
            </NavLink>
          ))}
        </nav>
        <StartButton />
      </div>
    </div>
  );
}
