import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUserId } from '@/features/auth';
import { groupKeys } from '@/features/groups';
import { supabase } from '@/shared/lib/supabase';
import { targetKey, type TargetRef } from '@/shared/types/target';
import type { ReactionSummary } from '../types';

export const reactionKeys = {
  target: (target: TargetRef) =>
    [...groupKeys.scope(target.groupId), 'reactions', ...targetKey(target)] as const,
};

/** Fire reactions on one object: count and whether I reacted. */
export function useReactions(target: TargetRef) {
  const userId = useUserId();
  return useQuery({
    queryKey: reactionKeys.target(target),
    queryFn: async (): Promise<ReactionSummary> => {
      const query = supabase
        .from('reactions')
        .select('user_id')
        .eq('group_id', target.groupId)
        .eq('target_type', target.type)
        .eq('target_id', target.id)
        .eq('kind', 'fire');
      const index = target.index ?? null;
      const { data, error } = await (index === null
        ? query.is('target_index', null)
        : query.eq('target_index', index));
      if (error) throw error;
      return {
        count: data.length,
        mine: data.some((row) => row.user_id === userId),
        userIds: data.map((row) => row.user_id),
      };
    },
  });
}

/** Toggles my fire reaction; the UI updates immediately and rolls back on error. */
export function useToggleReaction(target: TargetRef) {
  const queryClient = useQueryClient();
  const userId = useUserId();
  const key = reactionKeys.target(target);

  return useMutation({
    mutationFn: async (react: boolean) => {
      if (react) {
        const { error } = await supabase.from('reactions').insert({
          group_id: target.groupId,
          target_type: target.type,
          target_id: target.id,
          target_index: target.index ?? null,
          kind: 'fire',
        });
        // 23505: already reacted (e.g. double tap) — fine.
        if (error && error.code !== '23505') throw error;
      } else {
        const query = supabase
          .from('reactions')
          .delete()
          .eq('group_id', target.groupId)
          .eq('target_type', target.type)
          .eq('target_id', target.id)
          .eq('user_id', userId)
          .eq('kind', 'fire');
        const index = target.index ?? null;
        const { error } = await (index === null
          ? query.is('target_index', null)
          : query.eq('target_index', index));
        if (error) throw error;
      }
    },
    onMutate: async (react) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ReactionSummary>(key);
      if (previous) {
        const userIds = react
          ? [...previous.userIds.filter((id) => id !== userId), userId]
          : previous.userIds.filter((id) => id !== userId);
        queryClient.setQueryData<ReactionSummary>(key, {
          count: userIds.length,
          mine: react,
          userIds,
        });
      }
      return { previous };
    },
    onError: (_error, _react, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}
