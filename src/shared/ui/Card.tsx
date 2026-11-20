import type { HTMLAttributes } from 'react';
import { cn } from '@/shared/lib';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Use a slightly lighter surface, e.g. for cards on top of cards. */
  elevated?: boolean;
  padding?: 'none' | 'md' | 'lg';
}

const paddingClasses = { none: '', md: 'p-4', lg: 'p-5' } as const;

export function Card({ elevated = false, padding = 'md', className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-card border border-border',
        elevated ? 'bg-surface-2' : 'bg-surface',
        paddingClasses[padding],
        className,
      )}
      {...rest}
    />
  );
}
