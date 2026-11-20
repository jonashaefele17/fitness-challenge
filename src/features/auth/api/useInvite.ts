import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import type { InviteCheck, RedeemInviteInput } from '../types';

/** Looks up a code; resolves to null if it is unknown, expired, revoked or used up. */
export function useCheckInvite() {
  return useMutation({
    mutationFn: async (code: string): Promise<InviteCheck | null> => {
      const { data, error } = await supabase.rpc('check_invite', { p_code: code });
      if (error) throw error;
      const row = data[0];
      return row ? { groupId: row.group_id, groupName: row.group_name } : null;
    },
  });
}

export function useRedeemInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ code, displayName, homeGym }: RedeemInviteInput): Promise<string> => {
      const { data, error } = await supabase.rpc('redeem_invite', {
        p_code: code,
        ...(displayName !== undefined && { p_display_name: displayName }),
        ...(homeGym !== undefined && { p_home_gym: homeGym }),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      // Profile and memberships changed; refetch everything user-scoped.
      await queryClient.invalidateQueries();
    },
  });
}
