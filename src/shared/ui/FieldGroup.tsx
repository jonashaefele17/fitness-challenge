import { useId, type ReactNode } from 'react';

/**
 * A labelled group of controls (chips, icon choices). Not a <fieldset>: Safari lays out a
 * flex fieldset with its legend too tall until the next repaint, so the content below
 * jumped up at the first touch.
 */
export function FieldGroup({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="flex min-w-0 flex-col gap-2">
      <span id={id} className="text-subhead text-text-muted">
        {label}
      </span>
      {children}
    </div>
  );
}
