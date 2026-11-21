import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { spring } from '@/shared/design-tokens';
import { useActiveWorkout } from '../api/useWorkout';
import { elapsedSeconds, formatDuration } from '../format';

export interface WorkoutMiniBarProps {
  onOpen: () => void;
}

/** Shown above the navigation while a workout runs in the background. */
export function WorkoutMiniBar({ onOpen }: WorkoutMiniBarProps) {
  const workout = useActiveWorkout().data;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!workout) return;
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [workout]);

  if (!workout) return null;
  const done = workout.items.reduce(
    (count, item) => count + item.sets.filter((set) => set.completedAt !== null).length,
    0,
  );

  return (
    <motion.button
      type="button"
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={spring.snappy}
      onClick={onOpen}
      className="pointer-events-auto flex min-h-tap w-full items-center justify-between gap-3 rounded-pill glass px-5 text-subhead"
    >
      <span className="flex items-center gap-2">
        <span aria-hidden className="size-2.5 animate-pulse rounded-pill bg-accent" />
        <span className="font-semibold">{workout.trainingType.name}</span>
        <span className="text-text-muted">· {done} Sätze</span>
      </span>
      <span className="font-semibold tabular-nums">
        {formatDuration(elapsedSeconds(workout, now))}
        {workout.pausedAt ? ' · Pause' : ''}
      </span>
    </motion.button>
  );
}
