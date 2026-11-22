import { createContext } from 'react';
import type { Habit } from './types';

/** Someone's habit next to mine, in their person colour. */
export interface HabitPerson {
  id: string;
  name: string;
  /** CSS colour (their person colour). */
  color: string;
  habit: Habit;
}

export interface HabitCompare {
  /** Me as a column of the comparison (null: no comparison here). */
  me: Omit<HabitPerson, 'habit'> | null;
  /** The others who keep the same habit and share it. */
  people: HabitPerson[];
}

/**
 * Slot for comparing a habit: a hook the app plugs in (from the social comparison module).
 * Habits itself never knows about groups; without a provider nobody is shown.
 */
export type UseHabitCompare = (habit: Habit | null) => HabitCompare;

const noCompare: UseHabitCompare = () => ({ me: null, people: [] });

export const HabitCompareContext = createContext<UseHabitCompare>(noCompare);

/**
 * What makes two habits "the same": the same standard template, or taken over from the same
 * habit (the original counts as its own source).
 */
export function habitKey(habit: Habit): string {
  return habit.templateId ?? habit.sourceHabitId ?? habit.id;
}
