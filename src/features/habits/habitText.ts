import { formatMinutes } from './dates';
import type { HabitCondition, HabitDefinition, HabitValue } from './types';

const WEEKDAY_SHORT = ['', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/** "täglich", "Mo, Mi", "4× pro Woche" */
export function frequencyText(
  def: Pick<HabitDefinition, 'frequency' | 'weekdays' | 'timesPerWeek'>,
): string {
  if (def.frequency === 'weekly') return `${String(def.timesPerWeek ?? 1)}× pro Woche`;
  if (def.frequency === 'weekdays') return def.weekdays.map((d) => WEEKDAY_SHORT[d]).join(', ');
  return 'täglich';
}

function amount(def: HabitDefinition, value: number | string): string {
  if (def.inputType === 'duration') return formatMinutes(Number(value));
  const number = typeof value === 'number' ? value.toLocaleString('de') : value;
  return def.unit ? `${number} ${def.unit}` : number;
}

function conditionText(def: HabitDefinition, c: HabitCondition): string {
  if (def.inputType === 'time_pair' && c.field === 'start') {
    return `ins Bett ${c.op === 'before' ? 'vor' : 'nach'} ${String(c.value)}`;
  }
  if (def.inputType === 'time_pair' && c.field === 'end') {
    return `auf ${c.op === 'before' ? 'vor' : 'nach'} ${String(c.value)}`;
  }
  const subject = def.inputType === 'time_pair' ? formatMinutes : (v: number) => amount(def, v);
  switch (c.op) {
    case 'min':
      return `mind. ${subject(Number(c.value))}`;
    case 'max':
      return `höchstens ${subject(Number(c.value))}`;
    case 'between':
      return `${subject(Number(c.value))} – ${subject(c.value2 ?? 0)}`;
    case 'before':
      return `vor ${String(c.value)}`;
    case 'after':
      return `nach ${String(c.value)}`;
  }
}

/** "mind. 7:00 h · ins Bett vor 23:15" */
export function ruleText(def: HabitDefinition): string {
  if (def.source === 'training') return 'aus deinen Trainings';
  if (def.inputType === 'checklist') return `${String(def.options.length)} Punkte abhaken`;
  if (def.inputType === 'choice') return def.options.map((o) => o.label).join(' / ');
  if (def.inputType === 'yes_no') return 'Ja/Nein';
  return def.rule.map((c) => conditionText(def, c)).join(' · ');
}

/** "täglich · mind. 7:00 h · morgens" */
export function summaryText(def: HabitDefinition): string {
  return [frequencyText(def), ruleText(def), def.timeOfDay === 'morning' ? 'morgens' : 'abends']
    .filter(Boolean)
    .join(' · ');
}

/** Short value for a tile: "7:45 h", "8.200", "Teilweise", "2/3" */
export function valueText(def: HabitDefinition, value: HabitValue | null): string | null {
  if (!value) return null;
  if ('done' in value) return value.done ? 'Ja' : 'Nein';
  if ('minutes' in value) return formatMinutes(value.minutes);
  if ('value' in value) return amount(def, value.value);
  if ('start' in value) return `${value.start}–${value.end}`;
  if ('choice' in value) return def.options.find((o) => o.key === value.choice)?.label ?? null;
  return `${String(value.checked.length)}/${String(def.options.length)}`;
}

/** What an unanswered checklist or time pair starts as (they can be saved as they are). */
export function startValue(def: HabitDefinition): HabitValue | null {
  if (def.inputType === 'checklist') return { checked: [] };
  if (def.inputType === 'time_pair') return { start: '23:00', end: '07:00' };
  return null;
}
