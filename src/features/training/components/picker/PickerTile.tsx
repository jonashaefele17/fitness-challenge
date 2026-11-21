import type { ReactNode } from 'react';
import { cn } from '@/shared/lib';
import type { ExerciseHistory } from '../../api/useCatalog';
import { Sparkline } from '../Sparkline';

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="pt-2 text-footnote font-semibold tracking-wide text-text-muted uppercase">
      {children}
    </h3>
  );
}

/** Tile with image area (placeholder until illustrations exist), title, subtitle, trend. */
export function PickerTile({
  title,
  subtitle,
  trend,
  selected = false,
  muted = false,
  onClick,
  onInfo,
}: {
  title: string;
  subtitle: string;
  trend?: ExerciseHistory['trend'] | undefined;
  selected?: boolean;
  /** Dimmed, e.g. a device type that is already at this place. */
  muted?: boolean;
  onClick: () => void;
  onInfo?: (() => void) | undefined;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        aria-pressed={selected || undefined}
        onClick={onClick}
        className={cn(
          'flex w-full flex-col overflow-hidden rounded-card border bg-surface-2 text-left active:bg-surface-3',
          selected ? 'border-accent' : 'border-border',
          muted && 'opacity-60',
        )}
      >
        <span
          aria-hidden
          className="flex aspect-[4/3] items-center justify-center image-backdrop text-large-title font-bold text-accent/70"
        >
          {title.charAt(0).toUpperCase()}
        </span>
        <span className="flex flex-col gap-1 p-3">
          <span className="line-clamp-2 text-subhead font-semibold">{title}</span>
          <span className="line-clamp-2 text-caption text-text-muted">{subtitle}</span>
          {trend && trend.length >= 2 && <Sparkline points={trend} />}
        </span>
      </button>
      {selected && (
        <span
          aria-hidden
          className="absolute top-1.5 left-1.5 flex size-7 items-center justify-center rounded-pill bg-accent text-footnote font-bold text-on-accent"
        >
          ✓
        </span>
      )}
      {onInfo && (
        <button
          type="button"
          aria-label={`${title}: Details`}
          onClick={onInfo}
          className="absolute top-1.5 right-1.5 flex size-tap items-center justify-center rounded-pill glass text-footnote font-bold"
        >
          i
        </button>
      )}
    </div>
  );
}
