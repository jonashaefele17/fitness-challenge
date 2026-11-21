import { createContext } from 'react';

/**
 * Opens one of my finished workouts in the workout screen (edit mode). The app provides it,
 * since only the app knows its routes; without a provider there is no "Bearbeiten".
 */
export const WorkoutEditContext = createContext<((workoutId: string) => void) | null>(null);
