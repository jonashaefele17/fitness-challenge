import type { HabitDefinition } from './types';

/** An own habit before anything is chosen. */
export const EMPTY_HABIT: HabitDefinition = {
  name: '',
  inputType: 'yes_no',
  unit: null,
  rule: [],
  frequency: 'daily',
  weekdays: [],
  timesPerWeek: null,
  timeOfDay: 'evening',
  options: [],
  source: 'manual',
};
