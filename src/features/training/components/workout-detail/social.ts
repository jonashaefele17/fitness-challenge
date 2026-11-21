import { createContext, type ComponentType, type ReactNode } from 'react';

/**
 * Slots for the social layer in a finished workout's detail (comments, reactions). The app
 * plugs them in from the social modules; training itself never knows about groups, and
 * without a provider the detail shows no social parts.
 */
export interface WorkoutSocialSlots {
  /** Under the workout's numbers: reactions and comments on the whole workout. */
  Workout?: ComponentType<{ workoutId: string; title: string }>;
  /** End of an exercise's header: its speech bubble. */
  Exercise?: ComponentType<{ itemId: string; title: string }>;
  /** Around a set row: opens the set's thread and marks comments and reactions on it. */
  Set?: ComponentType<{ itemId: string; index: number; title: string; children: ReactNode }>;
}

export const WorkoutSocialContext = createContext<WorkoutSocialSlots>({});
