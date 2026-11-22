import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useUserId } from '@/features/auth';
import { useUnreadCount } from '@/features/notifications';
import { trainingKeys, useActiveWorkout } from '@/features/training';
import { showToast } from '@/shared/lib';
import { paths } from '../paths';

/**
 * A workout can be started for me by someone else (training together). Then a notification
 * arrives: my running workout is re-read at once, so the mini bar shows up, and a toast
 * offers to open it (unless I am looking at it already).
 */
export function ActiveWorkoutSync() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const unread = useUnreadCount().data;
  const active = useActiveWorkout().data;
  const lastUnread = useRef(unread);
  const lastActiveId = useRef<string | null | undefined>(undefined);

  // Something new concerns me: maybe a workout started for me.
  useEffect(() => {
    if (unread !== undefined && lastUnread.current !== undefined && unread > lastUnread.current) {
      void queryClient.invalidateQueries({ queryKey: trainingKeys.active(userId) });
    }
    lastUnread.current = unread;
  }, [unread, queryClient, userId]);

  // Back in the app: re-read it as well (the notification may have come while away).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void queryClient.invalidateQueries({ queryKey: trainingKeys.active(userId) });
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [queryClient, userId]);

  // A running workout appeared that I did not open myself.
  const activeId = active?.id ?? null;
  const onWorkout = location.pathname === paths.liveWorkout;
  useEffect(() => {
    if (lastActiveId.current === null && activeId && !onWorkout) {
      showToast('Euer Training läuft', {
        label: 'Öffnen',
        onAction: () => void navigate(paths.liveWorkout),
      });
    }
    if (active !== undefined) lastActiveId.current = activeId;
  }, [activeId, active, onWorkout, navigate]);

  return null;
}
