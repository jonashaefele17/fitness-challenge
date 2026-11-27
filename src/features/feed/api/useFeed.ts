import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { groupKeys } from '@/features/groups';
import { supabase } from '@/shared/lib/supabase';
import type { Json } from '@/shared/types/database';
import type { FeedCard, FeedEvent, FeedSort } from '../types';

const PAGE_SIZE = 15;

export const feedKeys = {
  all: (groupId: string) => [...groupKeys.scope(groupId), 'feed'] as const,
  list: (groupId: string, sort: FeedSort) => [...feedKeys.all(groupId), sort] as const,
  today: (groupId: string) => [...feedKeys.all(groupId), 'today'] as const,
};

interface Cursor {
  day: string;
  at: string;
  id: string;
}

function toEvents(value: Json): FeedEvent[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return [];
    const text = (key: string) => (typeof raw[key] === 'string' ? raw[key] : null);
    const id = text('id');
    const type = text('type');
    if (!id || !type) return [];
    return [
      {
        id,
        type,
        targetType: text('targetType'),
        targetId: text('targetId'),
        data: raw.data ?? {},
        occurredAt: text('occurredAt') ?? '',
        createdAt: text('createdAt') ?? '',
      },
    ];
  });
}

/** Day cards, ~15 per page (concept: endless scroll). */
export function useFeed(groupId: string, sort: FeedSort) {
  return useInfiniteQuery({
    queryKey: feedKeys.list(groupId, sort),
    initialPageParam: null as Cursor | null,
    queryFn: async ({ pageParam }): Promise<FeedCard[]> => {
      const { data, error } = await supabase.rpc('feed_cards', {
        p_group_id: groupId,
        p_sort: sort,
        p_limit: PAGE_SIZE,
        ...(pageParam && {
          p_before_day: pageParam.day,
          p_before_at: pageParam.at,
          p_before_id: pageParam.id,
        }),
      });
      if (error) throw error;
      return data.map((row) => ({
        id: row.id,
        groupId,
        actorId: row.actor_id,
        day: row.day,
        kind: row.kind === 'joined' || row.kind === 'season' ? row.kind : 'day',
        latestAt: row.latest_at,
        lastActivityAt: row.last_activity_at,
        events: toEvents(row.events),
      }));
    },
    getNextPageParam: (lastPage): Cursor | null => {
      const last = lastPage.at(-1);
      if (!last || lastPage.length < PAGE_SIZE) return null;
      return {
        day: last.day,
        at: sort === 'active' ? last.lastActivityAt : last.latestAt,
        id: last.id,
      };
    },
  });
}

/** Who trained today (for the avatar row above the feed). */
export function useTrainedToday(groupId: string) {
  return useQuery({
    queryKey: feedKeys.today(groupId),
    queryFn: async (): Promise<string[]> => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from('feed_events')
        .select('actor_id')
        .eq('group_id', groupId)
        .eq('type', 'workout_finished')
        .gte('occurred_at', start.toISOString());
      if (error) throw error;
      return [...new Set(data.map((row) => row.actor_id))];
    },
  });
}
