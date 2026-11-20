import { motion } from 'motion/react';
import { useId } from 'react';
import { spring } from '@/shared/design-tokens';
import { cn } from '@/shared/lib';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: string | undefined;
  disabled?: boolean;
}

/** iOS-style toggle row: label (and description) on the left, switch on the right. */
export function Switch({ checked, onCheckedChange, label, description, disabled }: SwitchProps) {
  const id = useId();
  return (
    <div className="flex min-h-tap items-center justify-between gap-4 py-2">
      <label htmlFor={id} className="flex min-w-0 flex-col">
        <span className="text-body">{label}</span>
        {description && <span className="text-footnote text-text-subtle">{description}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => {
          onCheckedChange(!checked);
        }}
        className={cn(
          'relative flex h-8 w-13 shrink-0 items-center rounded-pill p-0.5 transition-colors duration-(--duration-base) disabled:opacity-40',
          checked ? 'justify-end bg-accent' : 'justify-start bg-surface-3',
        )}
      >
        <motion.span layout transition={spring.snappy} className="size-7 rounded-pill bg-text" />
      </button>
    </div>
  );
}
