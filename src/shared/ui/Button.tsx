import { motion, type HTMLMotionProps } from 'motion/react';
import { forwardRef, type ReactNode } from 'react';
import { pressScale, spring } from '@/shared/design-tokens';
import { cn } from '@/shared/lib';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
  leadingIcon?: ReactNode;
  children?: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent active:bg-accent-pressed',
  secondary: 'bg-surface-2 text-text active:bg-surface-3',
  ghost: 'bg-transparent text-accent active:bg-surface-2',
  danger: 'bg-surface-2 text-danger active:bg-surface-3',
};

const sizeClasses: Record<Size, string> = {
  md: 'min-h-tap px-5 text-subhead',
  lg: 'min-h-14 px-6 text-body',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    loading = false,
    leadingIcon,
    disabled,
    className,
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  const isDisabled = disabled === true || loading;

  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...(!isDisabled && { whileTap: { scale: pressScale } })}
      transition={spring.press}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-pill font-semibold transition-colors duration-(--duration-fast) select-none',
        'disabled:opacity-40',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden
          className="size-5 animate-spin rounded-pill border-2 border-current border-t-transparent"
        />
      ) : (
        leadingIcon
      )}
      {children}
    </motion.button>
  );
});
