import { createContext } from 'react';
import type { HistoryScope } from '../../api/useHistory';
import type { ExerciseSession } from '../../types';

/** Another person's history of the same exercise, to draw next to mine. */
export interface ComparePerson {
  id: string;
  name: string;
  /** CSS colour (their person colour). */
  color: string;
  sessions: ExerciseSession[];
}

export interface HistoryCompare {
  /** My own person colour while comparing (null: keep the accent). */
  myColor: string | null;
  /** People with data for this exercise in this scope. */
  people: ComparePerson[];
}

/**
 * Slot for comparison: a hook the app plugs in (from the social comparison module).
 * Training itself never knows about groups; without a provider nobody is shown.
 */
export type UseHistoryCompare = (scope: HistoryScope) => HistoryCompare;

const noCompare: UseHistoryCompare = () => ({ myColor: null, people: [] });

export const HistoryCompareContext = createContext<UseHistoryCompare>(noCompare);
