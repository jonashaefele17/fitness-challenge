import { createContext, type ComponentType } from 'react';

/**
 * Slots for training together (the app plugs them in from a social module). Training never
 * knows about sessions; without a provider a workout is just one person's.
 */
export interface LiveWorkoutSlots {
  /** Whether this running workout is trained together (then new exercises are for all). */
  useIsLive: (workoutId: string) => boolean;
  /** Keeps an exercise personal; called with its id before it is added. */
  useKeepPrivate: () => (itemId: string) => Promise<void>;
  /** Under the timer: who trains along. */
  Along: ComponentType<{ workoutId: string }> | null;
  /** Under the exercise card: the others' sets of this exercise. */
  Peers: ComponentType<{ workoutId: string; itemId: string }> | null;
}

export const LiveWorkoutContext = createContext<LiveWorkoutSlots>({
  useIsLive: () => false,
  useKeepPrivate: () => () => Promise.resolve(),
  Along: null,
  Peers: null,
});
