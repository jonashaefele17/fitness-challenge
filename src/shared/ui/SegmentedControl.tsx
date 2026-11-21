import { motion } from 'motion/react';
import { useId } from 'react';
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
}

/** iOS-style segmented control with a sliding lens. */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
}: SegmentedControlProps<T>) {
  const layoutId = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex min-h-tap rounded-pill bg-surface-2 p-1"
    >
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
              'relative flex-1 rounded-pill px-2 text-footnote font-semibold transition-colors duration-(--duration-fast)',
              selected ? 'text-text' : 'text-text-muted',
            )}
          >
            {selected && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-pill glass-lens"
                transition={spring.snappy}
              />
            )}
            <span className="relative">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
