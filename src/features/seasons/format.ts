import { frequencyText, ruleText } from '@/features/habits';
import { daysBetween } from './season';
import type {
  Season,
  SeasonDayMarker,
  SeasonGoalDot,
  SeasonHabit,
  SeasonOverviewRow,
  SeasonPhase,
  SeasonRules,
} from './types';

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
  season_habit_locked: 'Dieses Habit ist in der laufenden Saison fest.',
  season_habit_not_locked: 'Die Regel ist noch nicht fest – die Person kann sie selbst ändern.',
  season_habit_not_found: 'Dieses Habit gehört nicht mehr zur Saison.',
  habit_not_found: 'Dieses Habit gibt es nicht mehr.',
};

/** German text for an error from the season functions; null for an unknown one. */
export function seasonErrorText(error: unknown): string | null {
  const message =
    typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : '';
  return ERROR_TEXTS[message] ?? null;
}

/** A season habit's rule in words: "täglich · mind. 7:00 h · ins Bett vor 23:00". */
export function seasonHabitRuleText(habit: Pick<SeasonHabit, 'definition'>): string {
  const rule = ruleText(habit.definition);
  // A yes/no habit has no rule beyond being done.
  return habit.definition.inputType === 'yes_no' && habit.definition.source !== 'training'
    ? frequencyText(habit.definition)
    : `${frequencyText(habit.definition)} · ${rule}`;
}

/** How it went: "80 % · 12 von 15 Tagen"; nothing counted yet: "Noch nichts gezählt". */
export function seasonHabitQuotaText(
  habit: Pick<SeasonHabit, 'quotaPct' | 'met' | 'counted' | 'countUnit'>,
): string {
  if (habit.quotaPct === null || habit.counted === 0) return 'Noch nichts gezählt';
  const unit =
    habit.countUnit === 'weeks'
      ? habit.counted === 1
        ? 'Woche'
        : 'Wochen'
      : habit.counted === 1
        ? 'Tag'
        : 'Tagen';
  return `${String(Math.round(habit.quotaPct))} % · ${String(habit.met)} von ${String(habit.counted)} ${unit}`;
}

const untilFormat = new Intl.DateTimeFormat('de', {
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** An open edit window: "Änderbar bis Fr., 18:30". */
export function seasonHabitEditText(editOpenUntil: string): string {
  return `Änderbar bis ${untilFormat.format(new Date(editOpenUntil))}`;
}

/** A season goal as a dot: target reached, on track, behind, or nothing measured yet. */
export type GoalDotState = 'reached' | 'on_track' | 'behind' | 'open';

export function goalDotState(dot: Pick<SeasonGoalDot, 'status' | 'onTrack'>): GoalDotState {
  if (dot.status === 'target_reached') return 'reached';
  if (dot.onTrack === null) return 'open';
  return dot.onTrack ? 'on_track' : 'behind';
}

const DOT_LABELS: Record<GoalDotState, string> = {
  reached: 'Ziel erreicht',
  on_track: 'Auf Kurs',
  behind: 'Hinter Plan',
  open: 'Noch kein Stand',
};

/** The words for a dot (screen readers, the legend). */
export function goalDotLabel(state: GoalDotState): string {
  return DOT_LABELS[state];
}

/** "Wochenziel in 3 von 4 Wochen"; no finished week yet: "Wochenziel: noch keine Woche fertig". */
export function trainingWeeksText(weeks: { counted: number; met: number }): string {
  if (weeks.counted === 0) return 'Wochenziel: noch keine Woche fertig';
  return `Wochenziel in ${String(weeks.met)} von ${String(weeks.counted)} ${
    weeks.counted === 1 ? 'Woche' : 'Wochen'
  }`;
}

/**
 * The small figures of a participant: "Habits 75 %", "Gewogen 3/4", "Zwischenstand 1/1" –
 * only what applies (habits only with season habits, "–" while nothing counted; the rules
 * only when the season has them).
 */
export function overviewFigures(
  row: Pick<SeasonOverviewRow, 'habitCount' | 'habitQuotaPct' | 'weighed' | 'checkins'>,
): string[] {
  const parts: string[] = [];
  if (row.habitCount > 0) {
    parts.push(
      `Habits ${row.habitQuotaPct === null ? '–' : `${String(Math.round(row.habitQuotaPct))} %`}`,
    );
  }
  if (row.weighed) parts.push(`Gewogen ${String(row.weighed.done)}/${String(row.weighed.due)}`);
  if (row.checkins) {
    parts.push(`Zwischenstand ${String(row.checkins.done)}/${String(row.checkins.due)}`);
  }
  return parts;
}

/** "1 Kraftziel", "2 Kraftziele". */
export function strengthGoalsText(count: number): string {
  return count === 1 ? '1 Kraftziel' : `${String(count)} Kraftziele`;
}

/** "+15 %", "−3 %", "0 %": the strength axis, whole numbers so the labels fit its margin. */
export function strengthAxisText(value: number): string {
  const rounded = Math.round(value);
  if (rounded === 0) return '0 %';
  return `${rounded > 0 ? '+' : '−'}${String(Math.abs(rounded))} %`;
}

/** "35 %" (progress axis and readout). */
export function progressPctText(value: number): string {
  return `${String(Math.round(value))} %`;
}
