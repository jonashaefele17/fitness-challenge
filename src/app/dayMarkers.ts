import type { BodyDayMarkerKind } from '@/features/body';
import type { SeasonDayMarkerKind } from '@/features/seasons';
import type { CalendarDayMarker } from '@/features/training';

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

/** A marker with what the day sheet names it by (the season's name). */
export interface NamedDayMarker extends DayMarker {
  seasonName?: string;
}

const LABELS: Record<DayMarkerKind, string> = {
  season_start: 'Saisonstart',
  season_end: 'Saisonende',
  weigh_day: 'Wiegetag',
  checkin_due: 'Zwischenstand',
};

/** How the calendar shows a marker: flag (season), finish flag (end, highlighted), scale. */
export function toCalendarMarker(marker: NamedDayMarker): CalendarDayMarker {
  const season = marker.kind === 'season_start' || marker.kind === 'season_end';
  return {
    icon: marker.kind === 'season_end' ? 'finish' : season ? 'flag' : 'scale',
    label: marker.seasonName
      ? `${LABELS[marker.kind]} · ${marker.seasonName}`
      : LABELS[marker.kind],
    scope: season ? 'group' : 'personal',
    strong: marker.kind === 'season_end',
  };
}

/** The calendar's markers per day, in rank order (see markersByDay). */
export function calendarMarkersByDay(
  markers: readonly NamedDayMarker[],
): Map<string, CalendarDayMarker[]> {
  const days = new Map<string, CalendarDayMarker[]>();
  for (const [day, list] of markersByDay(markers)) days.set(day, list.map(toCalendarMarker));
  return days;
}
