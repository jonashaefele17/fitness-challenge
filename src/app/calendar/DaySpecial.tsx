import { DayWeight } from '@/features/body';
import { FinishFlagIcon, FlagIcon, ScaleIcon } from '@/shared/ui';
import { calendarMarkersByDay } from '../dayMarkers';
import { useDayMarkers } from './useDayMarkers';

/**
 * "Besonderes" at the top of a calendar day: its special days (season start or end, weigh
 * day, check-in due) as quiet lines, then the day's weight.
 */
export function DaySpecial({ day }: { day: string }) {
  const markers = calendarMarkersByDay(useDayMarkers(day, day)).get(day) ?? [];
  return (
    <>
      {markers.length > 0 && (
        <ul aria-label="Besonderes" className="flex flex-col gap-1 px-1">
          {markers.map((marker) => {
            const Icon =
              marker.icon === 'scale'
                ? ScaleIcon
                : marker.icon === 'finish'
                  ? FinishFlagIcon
                  : FlagIcon;
            return (
              <li
                key={marker.label}
                className="flex min-h-8 items-center gap-2 text-subhead text-text-muted"
              >
                <Icon
                  aria-hidden
                  className={marker.strong ? 'shrink-0 text-accent' : 'shrink-0 text-text-subtle'}
                />
                <span className={marker.strong ? 'text-text' : undefined}>{marker.label}</span>
              </li>
            );
          })}
        </ul>
      )}
      <DayWeight day={day} />
    </>
  );
}
