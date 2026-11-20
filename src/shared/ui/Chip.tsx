import { motion, type HTMLMotionProps } from 'motion/react';
import type { ReactNode } from 'react';
import { pressScale, spring } from '@/shared/design-tokens';
import { cn } from '@/shared/lib';

export interface ChipProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  selected?: boolean;
  leadingIcon?: ReactNode;
  children?: ReactNode;
}

/**
 * Compact pill (32px visual height). An invisible ::before extends the hit area
 * to the 44px minimum touch target.
 */
export function Chip({
  selected = false,
  leadingIcon,
  className,
  children,
  type = 'button',
  ...rest
}: ChipProps) {
  return (
    <motion.button
      type={type}
      aria-pressed={selected}
      whileTap={{ scale: pressScale }}
      transition={spring.press}
      className={cn(
        'relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-pill px-3.5 text-footnote font-medium transition-colors duration-(--duration-fast)',
        "before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-['']",
        selected
          ? 'bg-accent text-on-accent'
          : 'border border-border bg-surface-2 text-text-muted active:bg-surface-3',
        className,
      )}
      {...rest}
    >
      {leadingIcon}
      {children}
    </motion.button>
  );
}
