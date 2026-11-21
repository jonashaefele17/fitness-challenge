import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { PersonColorKey } from '@/shared/design-tokens';
import { supabase } from '@/shared/lib/supabase';
import type { Profile } from '../types';
import { profileKeys } from './useMyProfile';

/**
 * Choose my person colour. The server refuses colours a group mate already has
 * ("color_taken"); the profile updates immediately and rolls back on error.
 */
export function useSetMyColor(userId: string) {
  const queryClient = useQueryClient();
  const key = profileKeys.detail(userId);
  return useMutation({
    mutationFn: async (color: PersonColorKey) => {
      const { error } = await supabase.rpc('set_my_color', { p_color: color });
      if (error) throw error;
    },
    onMutate: async (color) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Profile | null>(key);
      if (previous) queryClient.setQueryData<Profile>(key, { ...previous, color });
      return { previous };
    },
    onError: (_error, _color, context) => {
      queryClient.setQueryData(key, context?.previous);
    },
  });
}
