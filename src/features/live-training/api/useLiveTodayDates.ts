import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useUserId } from '@/features/auth';
import { useActiveWorkout } from '@/features/training';
import type { LiveToday } from '../types';
import { liveKeys, useLiveToday } from './useLive';

function todayKey(): string {
  const now = new Date();
  return `${String(now.getFullYear())}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Today's plan dates of others I take part in. A date I trained already (and finished) is
 * gone; one I train right now stays (it says so).
 */
export function useLiveTodayDates(): LiveToday[] {
  const [today] = useState(todayKey);
  const activeId = useActiveWorkout().data?.id ?? null;
  const dates = (useLiveToday(today).data ?? []).filter(
    (d) => d.myWorkoutId === null || d.myWorkoutId === activeId,
  );
  // A workout started for me (or ended): the dates are re-read.
  const userId = useUserId();
  const queryClient = useQueryClient();
  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: liveKeys.today(userId, today) });
  }, [activeId, queryClient, userId, today]);
  return dates;
}
