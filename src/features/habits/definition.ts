import type { HabitDefinition } from './types';

const FIELDS: (keyof HabitDefinition)[] = [
  'name',
  'inputType',
  'unit',
  'rule',
  'frequency',
  'weekdays',
  'timesPerWeek',
  'timeOfDay',
  'options',
  'source',
];

/**
 * The fields of a definition that differ from before (empty: nothing to save – no new
 * version, so an unchanged rule never counts as a change).
 */
export function changedFields(
  before: HabitDefinition,
  after: HabitDefinition,
): Partial<HabitDefinition> {
  const changed: Partial<HabitDefinition> = {};
  for (const field of FIELDS) {
    if (JSON.stringify(before[field]) !== JSON.stringify(after[field])) {
      Object.assign(changed, { [field]: after[field] });
    }
  }
  return changed;
}

const ERROR_TEXTS: Record<string, string> = {
  season_habit_locked: 'Dieses Habit ist in der laufenden Saison fest.',
};

/** German text for an error from the habit functions; null for an unknown one. */
export function habitErrorText(error: unknown): string | null {
  const message =
    typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : '';
  return ERROR_TEXTS[message] ?? null;
}
