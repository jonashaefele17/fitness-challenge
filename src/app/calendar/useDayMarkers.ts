import { useBodyDayMarkers } from '@/features/body';
import { addGoalDays, goalTodayKey } from '@/features/goals';
import { useSeasonDayMarkers } from '@/features/seasons';
import type { UseCalendarMarkers } from '@/features/training';
import { calendarMarkersByDay, type NamedDayMarker } from '../dayMarkers';

/** My weigh days are asked for at most this far ahead (the database caps a year). */
const BODY_REACH_DAYS = 180;

/**
 * Everything special in a range, from the modules that compute it: the group's season
 * start and end days, and my coming weigh days and due check-in. Never stored.
 */
export function useDayMarkers(from: string, to: string): NamedDayMarker[] {
  const today = goalTodayKey();
  const seasons = useSeasonDayMarkers(from, to).data ?? [];
  // Body markers are never in the past (weigh days are reminders, a due check-in is today
  // at the earliest).
  const bodyFrom = maxDay(from, today);
  const bodyTo = minDay(to, addGoalDays(today, BODY_REACH_DAYS));
  const body = useBodyDayMarkers(bodyFrom, bodyTo, today).data ?? [];
  return [
    ...seasons.map((m) => ({ onDate: m.onDate, kind: m.kind, seasonName: m.seasonName })),
    ...body,
  ];
}

/** The calendar's "Tages-Marker" slot (plugged in in AppGate). */
export const useCalendarMarkers: UseCalendarMarkers = (range) =>
  calendarMarkersByDay(useDayMarkers(range.from, range.to));

const maxDay = (a: string, b: string) => (a > b ? a : b);
const minDay = (a: string, b: string) => (a < b ? a : b);
