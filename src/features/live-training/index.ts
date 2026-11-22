import type { LiveWorkoutSlots } from '@/features/training';
import { useIsLive, useKeepPrivate } from './api/useLive';
import { PeerSetsRow, TrainingAlong } from './components/LiveParts';

/** Plugs training together into the workout screen (composed in the app). */
export const liveWorkoutSlots: LiveWorkoutSlots = {
  useIsLive,
  useKeepPrivate,
  Along: TrainingAlong,
  Peers: PeerSetsRow,
};

export { useTrainedAlong } from './api/useLive';
export { LiveDateButton } from './components/LiveDate';
export { useLiveTodayDates } from './api/useLiveTodayDates';
export type { LiveToday } from './types';
