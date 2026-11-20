import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import type { GroupMembership } from '../types';

export const groupKeys = {
  all: ['groups'] as const,
  mine: (userId: string) => [...groupKeys.all, 'mine', userId] as const,
  /**
   * Prefix for every group-scoped query (feed, seasons, comments …), e.g.
   * [...groupKeys.scope(groupId), 'feed']. Keeps caches separate per group.
   */
  scope: (groupId: string) => ['group', groupId] as const,
};

/** All groups the signed-in user belongs to, oldest membership first. */
export function useMyGroups(userId: string | null) {
  return useQuery({
    queryKey: groupKeys.mine(userId ?? 'anonymous'),
    enabled: userId !== null,
    queryFn: async (): Promise<GroupMembership[]> => {
      if (userId === null) return [];
      const { data, error } = await supabase
        .from('group_members')
        .select('role, joined_at, groups!inner(id, name)')
        .eq('user_id', userId)
        .order('joined_at', { ascending: true });
      if (error) throw error;
      return data.map((row) => ({
        id: row.groups.id,
        name: row.groups.name,
        role: row.role,
        joinedAt: row.joined_at,
      }));
    },
  });
}
