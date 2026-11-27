import { bodyMarkerText } from '@/features/body';
import { goalDaysBetween } from '@/features/goals';
import { seasonMarkerText, type Season } from '@/features/seasons';
import type { NamedDayMarker } from '../dayMarkers';

/** How far ahead Heute looks for each kind of special day. */
const AHEAD_DAYS = { season_start: 7, season_end: 7, weigh_day: 1, checkin_due: 3 } as const;

export interface UpcomingLine {
  key: string;
  text: string;
  kind: NamedDayMarker['kind'];
}

/**
 * The calm lines on Heute for special days just ahead: "Morgen Wiegetag", "Noch 5 Tage bis
 * Saisonende". Today's weigh day and due check-in are left out (their own cards show then),
 * and so is the season start while the setup card says it.
 */
export function upcomingLines(
  markers: readonly NamedDayMarker[],
  today: string,
  options: { setupCardShown: boolean },
): UpcomingLine[] {
  const lines: UpcomingLine[] = [];
  const seen = new Set<string>();
  const sorted = [...markers].sort((a, b) =>
    a.onDate < b.onDate ? -1 : a.onDate > b.onDate ? 1 : 0,
  );
  for (const marker of sorted) {
    const days = goalDaysBetween(today, marker.onDate);
    if (days < 0 || days > AHEAD_DAYS[marker.kind]) continue;
    const { kind, onDate } = marker;
    const season = kind === 'season_start' || kind === 'season_end';
    if (!season && days === 0) continue;
    if (marker.kind === 'season_start' && options.setupCardShown) continue;
    // One line per kind (the nearest).
    if (seen.has(marker.kind)) continue;
    seen.add(marker.kind);
    lines.push({
      key: `${marker.kind}:${marker.onDate}`,
      kind: marker.kind,
      text:
        kind === 'season_start' || kind === 'season_end'
          ? seasonMarkerText({ kind, onDate }, today)
          : bodyMarkerText({ kind, onDate }, today),
    });
  }
  return lines;
}

/**
 * The line under "Saison einrichten": "„Winter“ · noch 5 Tage bis zum Start", close to the
 * start "„Winter“ startet in 3 Tagen – noch nicht bereit", a late entrant "… du steigst
 * später ein", catching up after the start "„Winter“ läuft – deine Ziele fehlen noch".
 */
export function setupCardText(
  season: Pick<Season, 'name' | 'daysUntilStart' | 'phase' | 'me'>,
): string {
  const name = `„${season.name}“`;
  if (season.me?.lateEntry) return `${name} · du steigst später ein`;
  if (season.phase === 'running') {
    return season.me && season.me.missingMetrics.length === 0
      ? `${name} läuft – tippe noch auf „Bereit“`
      : `${name} läuft – deine Ziele fehlen noch`;
  }
  const n = season.daysUntilStart;
  if (n <= 3) {
    const when = n <= 0 ? 'heute' : n === 1 ? 'morgen' : `in ${String(n)} Tagen`;
    return `${name} startet ${when} – noch nicht bereit`;
  }
  return `${name} · noch ${String(n)} Tage bis zum Start`;
}
