import type { ReactNode } from 'react';
import { cn } from '@/shared/lib';

export interface ScreenProps {
  title: string;
  /** Element shown to the right of the large title (e.g. bell). */
  accessory?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/** Page scaffold with an iOS-style large title, respecting safe areas. */
export function Screen({ title, accessory, children, className }: ScreenProps) {
  return (
    <div className={cn('px-gutter pt-safe', className)}>
      <header className="flex items-end justify-between pt-4 pb-4">
        <h1 className="text-large-title font-bold">{title}</h1>
        {accessory}
      </header>
      {children}
    </div>
  );
}
