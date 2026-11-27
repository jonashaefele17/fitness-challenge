import { cn } from '@/shared/lib';
import { FinishFlagIcon, FlagIcon, ScaleIcon } from '@/shared/ui';
import type { CalendarDayMarker } from './markers';

/**
 * The marker at a date number: a small icon at its upper right, so the cell below stays free
 * for the trainings. The season end in the accent colour.
 */
export function DayMarkerIcon({
  marker,
  className,
}: {
  marker: CalendarDayMarker | undefined;
  className?: string;
}) {
  if (!marker) return null;
  const Icon =
    marker.icon === 'scale' ? ScaleIcon : marker.icon === 'finish' ? FinishFlagIcon : FlagIcon;
  return (
    <Icon
      aria-hidden
      strokeWidth={2.5}
      className={cn(
        'pointer-events-none absolute -top-1 -right-2.5 size-2.5',
        marker.strong ? 'text-accent' : 'text-text-muted',
        className,
      )}
    />
  );
}
