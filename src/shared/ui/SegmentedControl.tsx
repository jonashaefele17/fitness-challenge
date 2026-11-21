import { motion } from 'motion/react';
import { spring } from '@/shared/design-tokens';
import { cn } from '@/shared/lib';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  label: string;
  /** compact: only as wide as its labels (a secondary switch next to the screen's main one). */
  size?: 'full' | 'compact';
}

/**
 * iOS-style segmented control with a sliding lens. The lens only moves sideways inside the
 * control (no shared-layout animation), so it stays put when the surrounding content or a
 * sheet changes height.
 */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  size = 'full',
}: SegmentedControlProps<T>) {
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'relative min-h-tap rounded-pill bg-surface-2 p-1',
        // Compact: equal columns as wide as the longest label, so the lens math still holds.
        size === 'compact' ? 'inline-grid auto-cols-fr grid-flow-col' : 'flex',
      )}
    >
      <motion.span
        aria-hidden
        className="absolute inset-y-1 left-1 rounded-pill glass-lens"
        style={{ width: `calc((100% - 2 * var(--spacing)) / ${String(options.length)})` }}
        initial={false}
        animate={{ x: `${String(index * 100)}%` }}
        transition={spring.snappy}
      />
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => {
              onChange(option.value);
            }}
            className={cn(
              'relative flex-1 rounded-pill text-footnote font-semibold transition-colors duration-(--duration-fast)',
              size === 'compact' ? 'px-3' : 'px-2',
              selected ? 'text-text' : 'text-text-muted',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
