import { createContext } from 'react';
import type { CalendarWorkout } from '../../types';

/** Another person's finished workouts in the visible range. */
export interface CalendarPerson {
  id: string;
  name: string;
  /** CSS colour (their person colour). */
  color: string;
  workouts: CalendarWorkout[];
}

export interface CalendarPeople {
  /** Whether there is anyone to show ("Alle" is offered only then). */
  available: boolean;
  /** My person colour, used while others are shown. */
  myColor: string | null;
  /** My display name (for my avatar while others are shown). */
  myName: string | null;
  people: CalendarPerson[];
}

/**
 * Slot for "Alle" in the calendar: a hook the app plugs in from a social module. Training
 * never knows about groups; without a provider the calendar shows only my workouts.
 */
export type UseCalendarPeople = (
  range: { from: Date; to: Date },
  enabled: boolean,
) => CalendarPeople;

const nobody: UseCalendarPeople = () => ({
  available: false,
  myColor: null,
  myName: null,
  people: [],
});

export const CalendarPeopleContext = createContext<UseCalendarPeople>(nobody);
