import { motion } from 'motion/react';
import type { ComponentType, SVGProps } from 'react';
import { NavLink } from 'react-router';
import { spring } from '@/shared/design-tokens';
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
export function PillNav() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-safe z-30 flex items-center gap-3 px-gutter">
      <nav
        aria-label="Hauptnavigation"
        className="pointer-events-auto flex h-nav flex-1 items-center rounded-pill bg-glass p-1 shadow-float backdrop-blur-xl"
      >
        {tabs.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'relative flex h-full flex-1 flex-col items-center justify-center gap-0.5 rounded-pill text-caption font-medium transition-colors duration-(--duration-fast)',
                isActive ? 'text-text' : 'text-text-subtle',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="pill-nav-indicator"
                    className="absolute inset-0 rounded-pill bg-surface-3"
                    transition={spring.snappy}
                  />
                )}
                <Icon className="relative text-title-3" />
                <span className="relative">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <StartButton />
    </div>
  );
}
