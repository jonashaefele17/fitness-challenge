import type { BodyDayMarkerKind } from '@/features/body';
import type { SeasonDayMarkerKind } from '@/features/seasons';

/**
 * Special days in the calendar, put together here from the modules that compute them
 * (seasons: group markers; body: my weigh days and due check-in). Never stored.
 */
export type DayMarkerKind = SeasonDayMarkerKind | BodyDayMarkerKind;

export interface DayMarker {
  onDate: string;
  kind: DayMarkerKind;
}

/** Concept "Besondere Tage im Kalender": one marker per day, in this order. */
const RANK: readonly DayMarkerKind[] = ['season_end', 'season_start', 'weigh_day', 'checkin_due'];

/**
 * The markers per day in rank order (the first one is shown at the day number, the rest
 * go into the day sheet under "Besonderes"); the same kind twice on a day counts once.
 */
export function markersByDay<T extends DayMarker>(markers: readonly T[]): Map<string, T[]> {
  const days = new Map<string, T[]>();
  for (const marker of markers) {
    const list = days.get(marker.onDate) ?? [];
    if (!list.some((m) => m.kind === marker.kind)) list.push(marker);
    days.set(marker.onDate, list);
  }
  for (const list of days.values()) {
    list.sort((a, b) => RANK.indexOf(a.kind) - RANK.indexOf(b.kind));
  }
  return days;
}
