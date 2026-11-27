import type { BodyDayMarker, BodyDayMarkerKind } from './types';

/** Whole days from `from` to `to` (local days "2026-12-01"; negative: before). */
export function daysFromTo(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** The name of a marker in the day sheet ("Besonderes"). */
export function bodyMarkerLabel(kind: BodyDayMarkerKind): string {
  return kind === 'weigh_day' ? 'Wiegetag' : 'Zwischenstand';
}

/**
 * A marker as an upcoming day on Heute: "Heute Wiegetag", "Morgen Wiegetag",
 * "Wiegetag in 3 Tagen" (same for "Zwischenstand"); a day before today: just the label.
 */
export function bodyMarkerText(marker: BodyDayMarker, today: string): string {
  const label = bodyMarkerLabel(marker.kind);
  const days = daysFromTo(today, marker.onDate);
  if (days === 0) return `Heute ${label}`;
  if (days === 1) return `Morgen ${label}`;
  if (days > 1) return `${label} in ${String(days)} Tagen`;
  return label;
}

/** The markers from today up to `withinDays` days ahead, by day (weigh day first). */
export function upcomingBodyMarkers(
  markers: readonly BodyDayMarker[],
  today: string,
  withinDays: number,
): BodyDayMarker[] {
  return markers
    .filter((m) => {
      const days = daysFromTo(today, m.onDate);
      return days >= 0 && days <= withinDays;
    })
    .sort((a, b) =>
      a.onDate === b.onDate
        ? Number(a.kind !== 'weigh_day') - Number(b.kind !== 'weigh_day')
        : a.onDate < b.onDate
          ? -1
          : 1,
    );
}
