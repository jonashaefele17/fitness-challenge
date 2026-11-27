import type { ReactNode } from 'react';
import { cn } from '@/shared/lib';

export interface ScreenProps {
  title: string;
  /** Small line above the title (e.g. today's date). */
  eyebrow?: string;
  /** Element shown to the right of the large title (e.g. bell). */
  accessory?: ReactNode;
  /** Shown above the title on the left, e.g. a back button on a pushed screen. */
  leading?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/** Page scaffold with an iOS-style large title, respecting safe areas. */
export function Screen({ title, eyebrow, accessory, leading, children, className }: ScreenProps) {
  return (
    <div className={cn('px-gutter pt-safe', className)}>
      {leading && <div className="flex min-h-tap items-center pt-2">{leading}</div>}
      <header className={cn('flex items-end justify-between pb-4', leading ? 'pt-1' : 'pt-4')}>
        <div className="flex min-w-0 flex-col">
          {eyebrow && <span className="text-subhead text-text-muted">{eyebrow}</span>}
          <h1 className="truncate text-large-title font-bold">{title}</h1>
        </div>
        {accessory}
      </header>
      {children}
    </div>
  );
}
