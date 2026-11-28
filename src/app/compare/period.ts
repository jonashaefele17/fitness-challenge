import { periodRange } from '@/features/body';
import type { Season } from '@/features/seasons';

/** Vergleich → Zeitraum. */
export type ComparePeriod = 'season' | '4w' | '3m' | '1y';

/** Vergleich → Was. "Übersicht" is the season's and needs one (see periodSeason). */
export type CompareWhat = 'overview' | 'trainings' | 'habits' | 'weight';

/** What is shown: the chosen view, else "Übersicht" while a season runs, else Trainings. */
export function shownWhat(chosen: CompareWhat | null, season: Season | null): CompareWhat {
  if (chosen === 'overview') return season ? 'overview' : 'trainings';
  return chosen ?? (season?.phase === 'running' ? 'overview' : 'trainings');
}

/** The season the period "Saison" stands for: the current one once it has started. */
export function periodSeason(season: Season | null | undefined): Season | null {
  return season && (season.phase === 'running' || season.phase === 'ended') ? season : null;
}

/** What is shown: the chosen period, else "Saison" while one runs, else 4 weeks. */
export function shownPeriod(chosen: ComparePeriod | null, season: Season | null): ComparePeriod {
  if (chosen === 'season') return season ? 'season' : '4w';
  return chosen ?? (season?.phase === 'running' ? 'season' : '4w');
}

/**
 * The local days a period covers: the last 4 weeks / 3 months / year up to today, or the
 * season from its start up to today (at most its end).
 */
export function comparePeriodRange(
  period: ComparePeriod,
  today: string,
  season: Season | null,
): { from: string; to: string } {
  if (period === 'season' && season) {
    const to = season.endsOn < today ? season.endsOn : today;
    return { from: season.startsOn, to };
  }
  const range = periodRange(period === 'season' ? '4w' : period, today);
  return { from: range.from ?? today, to: range.to };
}
