import { periodRange } from '@/features/body';
import type { Season } from '@/features/seasons';

/** Vergleich → Zeitraum. */
export type ComparePeriod = 'season' | '4w' | '3m' | '1y';

/**
 * Vergleich → Was. "Übersicht" and "Kraft" are the season's and need one (see
 * periodSeason); "Kraft" also needs two participants with a strength goal.
 */
export type CompareWhat = 'overview' | 'trainings' | 'habits' | 'weight' | 'strength';

/**
 * What is shown: the chosen view, else "Übersicht" while a season runs, else Trainings. A
 * season view that is not there (any more) falls back to that default.
 */
export function shownWhat(
  chosen: CompareWhat | null,
  season: Season | null,
  strength = false,
): CompareWhat {
  const fallback = season?.phase === 'running' ? 'overview' : 'trainings';
  if (chosen === 'overview') return season ? 'overview' : 'trainings';
  if (chosen === 'strength') return season && strength ? 'strength' : fallback;
  return chosen ?? fallback;
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
