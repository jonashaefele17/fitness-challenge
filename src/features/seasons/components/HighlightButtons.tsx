import type { ReactNode } from 'react';
import { cn } from '@/shared/lib';

/**
 * The names under a season chart: tapping one highlights that line (again: none). Quiet on
 * purpose (no accent fill) – the line's own colour carries it. `children` go at the end of
 * the row (e.g. the legend of a reference line).
 */
export function HighlightButtons({
  lines,
  highlight,
  onChange,
  children,
}: {
  lines: readonly { key: string; name: string; color: string }[];
  highlight: string | null;
  onChange: (key: string | null) => void;
  children?: ReactNode;
}) {
  return (
    <div
      role="group"
      aria-label="Person hervorheben"
      className="flex flex-wrap items-center gap-x-2 gap-y-3"
    >
      {lines.map((line) => (
        <button
          key={line.key}
          type="button"
          aria-pressed={highlight === line.key}
          onClick={() => {
            onChange(highlight === line.key ? null : line.key);
          }}
          className={cn(
            'flex min-h-tap items-center gap-2 rounded-pill border px-4 text-subhead font-semibold',
            highlight === line.key
              ? 'border-text-subtle bg-surface-3 text-text'
              : 'border-border text-text-muted active:bg-surface-3',
            highlight !== null && highlight !== line.key && 'opacity-60',
          )}
        >
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-pill"
            style={{ backgroundColor: line.color }}
          />
          {line.name}
        </button>
      ))}
      {children}
    </div>
  );
}
