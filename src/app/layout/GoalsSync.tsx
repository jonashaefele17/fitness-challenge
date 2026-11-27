import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useUserId } from '@/features/auth';
import { bodyKeys } from '@/features/body';
import { goalKeys } from '@/features/goals';
import { habitKeys } from '@/features/habits';
import { trainingKeys } from '@/features/training';

/**
 * Goals are computed in SQL from trainings, weight, check-ins and habits. Whenever those
 * modules refresh their data after a change (they invalidate their own queries), the goals
 * follow: one invalidation per burst, and only goals on screen refetch. The modules stay
 * unaware of each other; this is the composition at app level (rule 14).
 */
export function GoalsSync() {
  const queryClient = useQueryClient();
  const userId = useUserId();

  useEffect(() => {
    const sources = [trainingKeys.all(userId), bodyKeys.all(userId), habitKeys.all(userId)];
    const fromSource = (key: readonly unknown[]) =>
      sources.some((source) => source.every((part, i) => key[i] === part));
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'invalidate') return;
      if (!fromSource(event.query.queryKey as readonly unknown[])) return;
      timer ??= setTimeout(() => {
        timer = null;
        void queryClient.invalidateQueries({ queryKey: goalKeys.all(userId) });
      }, 0);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [queryClient, userId]);

  return null;
}
