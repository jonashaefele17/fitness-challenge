import { useInfiniteQuery } from '@tanstack/react-query';
import { groupKeys } from '@/features/groups';
import { supabase } from '@/shared/lib/supabase';
import type { FeedEvent } from '../types';

const PAGE_SIZE = 15;

export const feedKeys = {
  list: (groupId: string) => [...groupKeys.scope(groupId), 'feed'] as const,
};

/** Newest first, ~15 cards per page (concept: endless scroll). */
export function useFeed(groupId: string) {
  return useInfiniteQuery({
    queryKey: feedKeys.list(groupId),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<FeedEvent[]> => {
      let query = supabase
        .from('feed_events')
        .select('id, group_id, actor_id, type, target_type, target_id, data, created_at')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(PAGE_SIZE);
      if (pageParam) query = query.lt('created_at', pageParam);
      const { data, error } = await query;
      if (error) throw error;
      return data.map((row) => ({
        id: row.id,
        groupId: row.group_id,
        actorId: row.actor_id,
        type: row.type,
        targetType: row.target_type,
        targetId: row.target_id,
        data: row.data,
        createdAt: row.created_at,
      }));
    },
    getNextPageParam: (lastPage) =>
      lastPage.length === PAGE_SIZE ? (lastPage[lastPage.length - 1]?.createdAt ?? null) : null,
  });
}
