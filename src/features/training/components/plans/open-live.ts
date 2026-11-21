import { createContext } from 'react';

/** Opens the running workout screen (the app provides it, it knows the route). */
export const OpenLiveWorkoutContext = createContext<(() => void) | null>(null);
