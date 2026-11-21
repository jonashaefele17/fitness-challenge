import { useId } from 'react';
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
          checked ? 'bg-accent' : 'bg-surface-3',
        )}
      >
        {/* The knob only slides inside the track (no layout animation), so it never flies in
            when the surrounding content changes height. */}
        <span
          className={cn(
            'size-7 rounded-pill bg-text transition-transform duration-(--duration-base) ease-out motion-reduce:transition-none',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  );
}
