import { useQuery } from '@tanstack/react-query';
import { isPersonColorKey } from '@/shared/design-tokens';
import { supabase } from '@/shared/lib/supabase';
import type { Profile } from '../types';

export const profileKeys = {
  all: ['profile'] as const,
  detail: (userId: string) => [...profileKeys.all, userId] as const,
};

/** The signed-in user's profile, or null before the first invite was redeemed. */
export function useMyProfile(userId: string | null) {
  return useQuery({
    queryKey: profileKeys.detail(userId ?? 'anonymous'),
    enabled: userId !== null,
    queryFn: async (): Promise<Profile | null> => {
      if (userId === null) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, home_gym, color, avatar_url, is_super_admin')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        displayName: data.display_name,
        homeGym: data.home_gym,
        color: isPersonColorKey(data.color) ? data.color : 'person-1',
        avatarUrl: data.avatar_url,
        isSuperAdmin: data.is_super_admin,
      };
    },
  });
}
