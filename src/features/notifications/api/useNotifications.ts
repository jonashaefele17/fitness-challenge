import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useUserId } from '@/features/auth';
import { supabase } from '@/shared/lib/supabase';
import type { Json } from '@/shared/types/database';
import type { AppNotification } from '../types';

// Safety net only; realtime delivers changes immediately.
const POLL_MS = 60_000;

export const notificationKeys = {
  all: (userId: string) => ['notifications', userId] as const,
  list: (userId: string) => [...notificationKeys.all(userId), 'list'] as const,
  unread: (userId: string) => [...notificationKeys.all(userId), 'unread'] as const,
  settings: (userId: string) => [...notificationKeys.all(userId), 'settings'] as const,
};

function readText(data: Json, key: string): string | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  const value = data[key];
  return typeof value === 'string' ? value : null;
}

/** Latest notifications of the signed-in user across all groups. */
export function useNotifications({ enabled = true }: { enabled?: boolean } = {}) {
  const userId = useUserId();
  return useQuery({
    queryKey: notificationKeys.list(userId),
    enabled,
    refetchInterval: POLL_MS,
    queryFn: async (): Promise<AppNotification[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select(
          'id, group_id, category, event, actor_id, target_type, target_id, target_index, comment_id, data, created_at, read_at',
        )
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data.map((row) => ({
        id: row.id,
        groupId: row.group_id,
        category: row.category,
        event: row.event,
        actorId: row.actor_id,
        target: {
          groupId: row.group_id,
          type: row.target_type,
          id: row.target_id,
          index: row.target_index,
        },
        commentId: row.comment_id,
        preview: readText(row.data, 'preview'),
        emoji: readText(row.data, 'emoji'),
        createdAt: row.created_at,
        readAt: row.read_at,
      }));
    },
  });
}

export function useUnreadCount() {
  const userId = useUserId();
  return useQuery({
    queryKey: notificationKeys.unread(userId),
    refetchInterval: POLL_MS,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .is('read_at', null);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

/** Refreshes bell and list, e.g. after a thread was read elsewhere. */
export function useInvalidateNotifications() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: notificationKeys.all(userId) }),
    [queryClient, userId],
  );
}

function useOptimisticRead() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return async (ids: string[] | 'all') => {
    await queryClient.cancelQueries({ queryKey: notificationKeys.all(userId) });
    const listKey = notificationKeys.list(userId);
    const unreadKey = notificationKeys.unread(userId);
    const previousList = queryClient.getQueryData<AppNotification[]>(listKey);
    const previousUnread = queryClient.getQueryData<number>(unreadKey);
    const now = new Date().toISOString();
    const affected =
      previousList?.filter((n) => n.readAt === null && (ids === 'all' || ids.includes(n.id)))
        .length ?? 0;
    queryClient.setQueryData<AppNotification[]>(
      listKey,
      previousList?.map((n) =>
        n.readAt === null && (ids === 'all' || ids.includes(n.id)) ? { ...n, readAt: now } : n,
      ),
    );
    queryClient.setQueryData<number>(
      unreadKey,
      ids === 'all' ? 0 : Math.max(0, (previousUnread ?? 0) - affected),
    );
    return { previousList, previousUnread };
  };
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  const optimistic = useOptimisticRead();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)
        .is('read_at', null);
      if (error) throw error;
    },
    onMutate: (id) => optimistic([id]),
    onError: (_error, _id, context) => {
      queryClient.setQueryData(notificationKeys.list(userId), context?.previousList);
      queryClient.setQueryData(notificationKeys.unread(userId), context?.previousUnread);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all(userId) }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  const optimistic = useOptimisticRead();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('mark_all_notifications_read');
      if (error) throw error;
    },
    onMutate: () => optimistic('all'),
    onError: (_error, _input, context) => {
      queryClient.setQueryData(notificationKeys.list(userId), context?.previousList);
      queryClient.setQueryData(notificationKeys.unread(userId), context?.previousUnread);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all(userId) }),
  });
}
