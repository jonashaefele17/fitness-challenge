import { daysBetween } from './season';
import type { Season, SeasonDayMarker, SeasonPhase, SeasonRules } from './types';

const PHASE_LABELS: Record<SeasonPhase, string> = {
  announced: 'Angekündigt',
  setup: 'Einrichten',
  running: 'Läuft',
  ended: 'Beendet',
  cancelled: 'Abgesagt',
};

/** "Einrichten", "Läuft" … */
export function seasonPhaseLabel(phase: SeasonPhase): string {
  return PHASE_LABELS[phase];
}

function days(n: number): string {
  return n === 1 ? '1 Tag' : `${String(n)} Tagen`;
}

/** "Woche 3 von 26" while running, otherwise the length: "26 Wochen". */
export function seasonWeekText(season: Pick<Season, 'weekNumber' | 'weekCount'>): string {
  if (season.weekNumber !== null) {
    return `Woche ${String(season.weekNumber)} von ${String(season.weekCount)}`;
  }
  return season.weekCount === 1 ? '1 Woche' : `${String(season.weekCount)} Wochen`;
}

/**
 * The countdown of a season in words: before the start "Start in 3 Tagen" / "Start
 * morgen" / "Start heute"; running "Noch 5 Tage bis Saisonende" / "Morgen ist Saisonende" /
 * "Heute ist Saisonende"; "Beendet" / "Abgesagt" afterwards.
 */
export function seasonCountdownText(
  season: Pick<Season, 'phase' | 'daysUntilStart' | 'daysUntilEnd'>,
): string {
  switch (season.phase) {
    case 'announced':
    case 'setup':
      if (season.daysUntilStart <= 0) return 'Start heute';
      if (season.daysUntilStart === 1) return 'Start morgen';
      return `Start in ${days(season.daysUntilStart)}`;
    case 'running':
      if (season.daysUntilEnd <= 0) return 'Heute ist Saisonende';
      if (season.daysUntilEnd === 1) return 'Morgen ist Saisonende';
      return `Noch ${String(season.daysUntilEnd)} Tage bis Saisonende`;
    default:
      return seasonPhaseLabel(season.phase);
  }
}

/** The name of a marker in the day sheet ("Besonderes"). */
export function seasonMarkerLabel(marker: Pick<SeasonDayMarker, 'kind'>): string {
  return marker.kind === 'season_start' ? 'Saisonstart' : 'Saisonende';
}

/**
 * A marker as an upcoming day on Heute: "Heute Saisonstart", "Morgen Saisonende",
 * "Noch 5 Tage bis Saisonende" / "Noch 3 Tage bis Saisonstart"; a day before today: just
 * the label.
 */
export function seasonMarkerText(marker: Pick<SeasonDayMarker, 'kind' | 'onDate'>, today: string) {
  const label = seasonMarkerLabel(marker);
  const n = daysBetween(today, marker.onDate);
  if (n === 0) return `Heute ${label}`;
  if (n === 1) return `Morgen ${label}`;
  if (n > 1) return `Noch ${String(n)} Tage bis ${label}`;
  return label;
}

/**
 * The rules as lines: "Jede Woche wiegen", "Zwischenstand alle 4 Wochen", "Pflicht:
 * Trainings pro Woche". `metricLabel` names a metric key (from the goal metrics).
 */
export function seasonRulesLines(
  rules: SeasonRules,
  metricLabel: (key: string) => string,
): string[] {
  const lines: string[] = [];
  if (rules.weighWeekly) lines.push('Jede Woche wiegen');
  if (rules.checkinEveryWeeks !== null) {
    lines.push(
      rules.checkinEveryWeeks === 1
        ? 'Zwischenstand jede Woche'
        : `Zwischenstand alle ${String(rules.checkinEveryWeeks)} Wochen`,
    );
  }
  if (rules.requiredMetrics.length > 0) {
    lines.push(`Pflicht: ${rules.requiredMetrics.map(metricLabel).join(', ')}`);
  }
  return lines;
}

/** "Noch offen: Trainings pro Woche"; null when nothing is missing. */
export function missingMetricsText(
  missing: readonly string[],
  metricLabel: (key: string) => string,
): string | null {
  return missing.length === 0 ? null : `Noch offen: ${missing.map(metricLabel).join(', ')}`;
}

const ERROR_TEXTS: Record<string, string> = {
  not_group_admin: 'Das kann nur ein Admin der Gruppe.',
  not_participant: 'Du nimmst an dieser Saison nicht teil.',
  season_goals_locked: 'Deine Saisonziele sind festgeschrieben.',
  season_goal_locked: 'Dieses Saisonziel ist festgeschrieben. Nur ein Admin kann es korrigieren.',
  season_goals_missing: 'Für „Bereit“ fehlt noch ein Pflicht-Ziel.',
  season_goal_not_locked:
    'Das Ziel ist noch nicht festgeschrieben – die Person kann es selbst ändern.',
  season_goal_period_fixed: 'Ein Saisonziel läuft über den Zeitraum der Saison.',
  season_goal_must_be_shared: 'Saisonziele sind für die Gruppe sichtbar.',
  setup_not_open: 'Das Einrichten ist noch nicht offen.',
  season_overlaps: 'In diesem Zeitraum gibt es schon eine Saison.',
  season_started: 'Die Saison läuft schon – nur der Name lässt sich noch ändern.',
  season_cancelled: 'Die Saison wurde abgesagt.',
  season_ended: 'Die Saison ist schon vorbei.',
  start_in_the_past: 'Der Start darf nicht in der Vergangenheit liegen.',
  invalid_period: 'Das Ende muss nach dem Start liegen.',
  invalid_setup_date: 'Das Einrichten muss vor dem Start öffnen.',
  invalid_late_start: 'Der eigene Start muss in der Saison liegen.',
  invalid_name: 'Bitte gib der Saison einen Namen.',
  participant_not_in_group: 'Teilnehmen kann nur, wer in der Gruppe ist.',
  goal_in_other_season: 'Dieses Ziel gehört schon zu einer anderen Saison.',
};

/** German text for an error from the season functions; null for an unknown one. */
export function seasonErrorText(error: unknown): string | null {
  const message =
    typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : '';
  return ERROR_TEXTS[message] ?? null;
}
