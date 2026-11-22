import { percent } from './cells';
import { formatMinutes } from './dates';
import type { HabitDefinition, HabitSummary, HabitWeek } from './types';

/** ↑ / ↓ / = against the range before (5 points make a change). */
export function trend(summary: HabitSummary | undefined): { mark: string; label: string } | null {
  if (summary?.quota == null || summary.previousQuota == null) return null;
  const diff = summary.quota - summary.previousQuota;
  if (diff > 0.05) return { mark: '↑', label: 'besser als davor' };
  if (diff < -0.05) return { mark: '↓', label: 'schwächer als davor' };
  return { mark: '=', label: 'wie davor' };
}

/** "23:27" from minutes after midnight. */
export function clock(minutes: number | null): string {
  if (minutes === null) return '–';
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** The three figures that say most about a habit, by its kind. */
export function figures(
  def: HabitDefinition,
  s: HabitSummary | undefined,
  weeks: HabitWeek[],
): { label: string; value: string }[] {
  const met = `${String(s?.met ?? 0)}/${String(s?.counted ?? 0)}`;
  const amount = (v: number | null) =>
    v === null
      ? '–'
      : def.inputType === 'duration'
        ? formatMinutes(Math.round(v))
        : `${v.toLocaleString('de', { maximumFractionDigits: 1 })}${def.unit ? ` ${def.unit}` : ''}`;
  if (def.frequency === 'weekly') {
    const counted = weeks.filter((w) => w.state === 'done' || w.state === 'missed');
    const avg =
      counted.length > 0 ? counted.reduce((sum, w) => sum + w.doneDays, 0) / counted.length : null;
    return [
      {
        label: 'Ø pro Woche',
        value: avg === null ? '–' : avg.toLocaleString('de', { maximumFractionDigits: 1 }),
      },
      { label: 'Wochen erreicht', value: met },
      { label: 'Quote', value: percent(s?.quota ?? null) },
    ];
  }
  switch (def.inputType) {
    case 'time_pair':
      return [
        { label: 'Ø Schlaf', value: s?.avgDuration == null ? '–' : formatMinutes(s.avgDuration) },
        { label: 'Ø ins Bett', value: clock(s?.avgStart ?? null) },
        { label: 'im Ziel', value: met },
      ];
    case 'duration':
    case 'number':
      return [
        { label: 'Ø pro Tag', value: amount(s?.avgValue ?? null) },
        { label: 'im Ziel', value: met },
        {
          label: def.inputType === 'duration' ? 'Bester Tag' : 'Bestwert',
          value: amount(s?.bestValue ?? null),
        },
      ];
    case 'choice':
      return def.options.map((o) => ({
        label: o.label,
        value: String(s?.choiceCounts[o.key] ?? 0),
      }));
    case 'checklist':
      return [
        {
          label: 'vollständig',
          value: `${String(s?.completeDays ?? 0)}/${String(s?.counted ?? 0)}`,
        },
        { label: 'Quote', value: percent(s?.quota ?? null) },
        { label: 'Punkte', value: String(def.options.length) },
      ];
    default:
      return [
        { label: 'erfüllt', value: met },
        { label: 'Quote', value: percent(s?.quota ?? null) },
        { label: 'Trend', value: trend(s)?.label ?? '–' },
      ];
  }
}
