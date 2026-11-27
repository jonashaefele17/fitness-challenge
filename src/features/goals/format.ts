import type { Goal, GoalBestSet, GoalPointState, GoalStatus, GoalUnit } from './types';

const oneDecimal = new Intl.NumberFormat('de', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const upToOneDecimal = new Intl.NumberFormat('de', { maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat('de', { maximumFractionDigits: 0 });

/** 90 → "1:30 min", 45 → "45 s". */
function formatSeconds(seconds: number): string {
  const total = Math.round(seconds);
  if (total < 60) return `${String(total)} s`;
  const minutes = Math.floor(total / 60);
  return `${String(minutes)}:${String(total % 60).padStart(2, '0')} min`;
}

/**
 * A goal value with its unit: "82,5 kg", "88,0 cm", "12 Wdh.", "1:30 min", "78 %",
 * "3,5 pro Woche"; null → "–".
 */
export function formatGoalValue(value: number | null, unit: GoalUnit): string {
  if (value === null) return '–';
  switch (unit) {
    case 'kg':
      return `${oneDecimal.format(value)} kg`;
    case 'cm':
      return `${oneDecimal.format(value)} cm`;
    case 'reps':
      return `${whole.format(value)} Wdh.`;
    case 'seconds':
      return formatSeconds(value);
    case 'percent':
      return `${whole.format(value)} %`;
    case 'per_week':
      return `${upToOneDecimal.format(value)} pro Woche`;
  }
}

/** A goal value without its unit (for inputs and compact rows): "82,5", "12", "3,5". */
export function formatGoalNumber(value: number | null, unit: GoalUnit): string {
  if (value === null) return '–';
  if (unit === 'kg' || unit === 'cm') return oneDecimal.format(value);
  if (unit === 'per_week') return upToOneDecimal.format(value);
  return whole.format(value);
}

/** A weight exercise's values are kg at a rep count: "100,0 kg bei 5 Wdh.". */
export function formatGoalTarget(value: number | null, goal: Pick<Goal, 'unit' | 'reps'>): string {
  const text = formatGoalValue(value, goal.unit);
  return value !== null && goal.unit === 'kg' && goal.reps !== null
    ? `${text} bei ${String(goal.reps)} Wdh.`
    : text;
}

/** The set behind an exercise value: "102,5 kg × 5", "12 Wdh.", "1:30 min". */
export function formatBestSet(set: GoalBestSet | null): string {
  if (set === null) return '–';
  if (set.weightKg !== null && set.reps !== null) {
    return `${oneDecimal.format(set.weightKg)} kg × ${String(set.reps)}`;
  }
  if (set.reps !== null) return `${whole.format(set.reps)} Wdh.`;
  if (set.durationSeconds !== null) return formatSeconds(set.durationSeconds);
  return '–';
}

/** Progress in whole percent: 85.7 → "86 %"; null → "–". */
export function formatProgress(pct: number | null): string {
  return pct === null ? '–' : `${whole.format(pct)} %`;
}

/** For a bar: 0 … 100 (below 0 is empty, above 100 full; null: empty). */
export function progressBarPct(pct: number | null): number {
  if (pct === null || Number.isNaN(pct)) return 0;
  return Math.min(100, Math.max(0, pct));
}

const statusTexts: Record<GoalStatus, string> = {
  target_reached: 'Ziel erreicht',
  min_reached: 'Mindestziel erreicht',
  below_min: 'Unter dem Mindestziel',
  not_reached: 'Noch nicht erreicht',
};

/** "Ziel erreicht", "Mindestziel erreicht", "Unter dem Mindestziel", "Noch nicht erreicht". */
export function goalStatusText(status: GoalStatus | null): string {
  return status === null ? 'Noch keine Werte' : statusTexts[status];
}

/** A week / history point: the status, or "Läuft noch" / "Pause". */
export function goalPointStateText(state: GoalPointState | null): string {
  if (state === 'open') return 'Läuft noch';
  if (state === 'paused') return 'Pause';
  return goalStatusText(state);
}

/** "Auf Kurs" / "Hinter Plan"; null (nothing to judge yet) → null. */
export function onTrackText(onTrack: boolean | null): string | null {
  if (onTrack === null) return null;
  return onTrack ? 'Auf Kurs' : 'Hinter Plan';
}

/** The goal's name: the exercise, habit or measurement, else the metric ("Körpergewicht"). */
export function goalTitle(goal: Pick<Goal, 'referenceLabel' | 'metricLabel'>): string {
  return goal.referenceLabel ?? goal.metricLabel;
}

/**
 * Rates in words: "In 2 von 3 Wochen Mindestziel, in 1 Ziel erreicht" (trainings),
 * "An 7 von 9 Tagen geschafft" (habit). null for levels.
 */
export function rateSummaryText(
  goal: Pick<Goal, 'metric' | 'metricKind' | 'counted' | 'minMet' | 'targetMet' | 'countUnit'>,
): string | null {
  if (goal.metricKind !== 'rate' || goal.counted === null) return null;
  const counted = String(goal.counted);
  const met = String(goal.targetMet ?? 0);
  if (goal.metric === 'trainings_per_week') {
    if (goal.counted === 0) return 'Noch keine abgeschlossene Woche';
    const weeks = goal.counted === 1 ? 'Woche' : 'Wochen';
    if (goal.minMet !== null) {
      return `In ${String(goal.minMet)} von ${counted} ${weeks} Mindestziel, in ${met} Ziel erreicht`;
    }
    return `In ${met} von ${counted} ${weeks} Ziel erreicht`;
  }
  if (goal.counted === 0) return 'Noch nichts gezählt';
  if (goal.countUnit === 'weeks') {
    return `In ${met} von ${counted} ${goal.counted === 1 ? 'Woche' : 'Wochen'} geschafft`;
  }
  return `An ${met} von ${counted} ${goal.counted === 1 ? 'Tag' : 'Tagen'} geschafft`;
}

/** Trainings: "Diese Woche 1 von 4"; null without a running week. */
export function thisWeekText(goal: Pick<Goal, 'thisWeek'>): string | null {
  if (goal.thisWeek === null) return null;
  return `Diese Woche ${String(goal.thisWeek.done)} von ${String(goal.thisWeek.target)}`;
}
