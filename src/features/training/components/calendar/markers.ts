import { createContext } from 'react';

/** What a special day shows at its date number. */
export type CalendarMarkerIcon = 'flag' | 'finish' | 'scale';

/** A special day (season start, weigh day …) as the calendar shows it; computed elsewhere. */
export interface CalendarDayMarker {
  icon: CalendarMarkerIcon;
  /** Its line in the day sheet ("Saisonende · Winterform"). */
  label: string;
  /** group: once for everyone (the group's date row); personal: in my row. */
  scope: 'group' | 'personal';
  /** Highlighted (the season end: goals are due). */
  strong: boolean;
}

/**
 * Slot "Tages-Marker": a hook the app plugs in (seasons, body). Per day the markers in rank
 * order – the first one shows at the date number, all of them in the day sheet. Training
 * never knows where they come from; without a provider there are none.
 */
export type UseCalendarMarkers = (range: {
  from: string;
  to: string;
}) => ReadonlyMap<string, readonly CalendarDayMarker[]>;

const none: ReadonlyMap<string, readonly CalendarDayMarker[]> = new Map();

export const CalendarMarkersContext = createContext<UseCalendarMarkers>(() => none);

/** The marker's words for the day's label (screen readers). */
export function markerLabels(markers: readonly CalendarDayMarker[] | undefined): string {
  return markers && markers.length > 0 ? `, ${markers.map((m) => m.label).join(', ')}` : '';
}
