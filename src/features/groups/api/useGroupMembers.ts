import { useQuery } from '@tanstack/react-query';
import { isPersonColorKey } from '@/shared/design-tokens';
import { supabase } from '@/shared/lib/supabase';
import type { GroupMember } from '../types';
import { groupKeys } from './useMyGroups';

/** Members of a group with their public profile data (name, avatar, colour). */
export function useGroupMembers(groupId: string) {
  return useQuery({
    queryKey: [...groupKeys.scope(groupId), 'members'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<GroupMember[]> => {
      const { data, error } = await supabase
        .from('group_members')
        .select('role, profiles!inner(id, display_name, avatar_url, color)')
        .eq('group_id', groupId)
        .order('joined_at', { ascending: true });
      if (error) throw error;
      return data.map((row) => ({
        userId: row.profiles.id,
        displayName: row.profiles.display_name,
        avatarUrl: row.profiles.avatar_url,
        color: isPersonColorKey(row.profiles.color) ? row.profiles.color : 'person-1',
        role: row.role,
      }));
    },
  });
}

/** Lookup by user id; unknown ids (e.g. people who left) resolve to undefined. */
export function useMemberLookup(groupId: string) {
  const members = useGroupMembers(groupId);
  const byId = new Map((members.data ?? []).map((member) => [member.userId, member]));
  return (userId: string | null | undefined) => (userId ? byId.get(userId) : undefined);
}
