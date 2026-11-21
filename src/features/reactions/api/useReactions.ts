import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUserId } from '@/features/auth';
import { groupKeys } from '@/features/groups';
import { supabase } from '@/shared/lib/supabase';
import { targetKey, type TargetRef } from '@/shared/types/target';
import type { ReactionKind, ReactionSummary } from '../types';

export const reactionKeys = {
  kinds: () => ['reaction-kinds'] as const,
  target: (target: TargetRef) =>
    [...groupKeys.scope(target.groupId), 'reactions', ...targetKey(target)] as const,
};

/** The reactions to choose from, in order (🔥 first: the quick one). */
export function useReactionKinds() {
  return useQuery({
    queryKey: reactionKeys.kinds(),
    staleTime: Infinity,
    queryFn: async (): Promise<ReactionKind[]> => {
      const { data, error } = await supabase
        .from('reaction_kinds')
        .select('key, emoji')
        .order('sort');
      if (error) throw error;
      return data;
    },
  });
}

/** Reactions on one object: who reacted how, and mine. */
export function useReactions(target: TargetRef) {
  const userId = useUserId();
  return useQuery({
    queryKey: reactionKeys.target(target),
    queryFn: async (): Promise<ReactionSummary> => {
      const query = supabase
        .from('reactions')
        .select('user_id, kind, created_at')
        .eq('group_id', target.groupId)
        .eq('target_type', target.type)
        .eq('target_id', target.id)
        .order('created_at');
      const index = target.index ?? null;
      const { data, error } = await (index === null
        ? query.is('target_index', null)
        : query.eq('target_index', index));
      if (error) throw error;
      return {
        reactions: data.map((row) => ({ userId: row.user_id, kind: row.kind })),
        mine: data.find((row) => row.user_id === userId)?.kind ?? null,
      };
    },
  });
}

/** Sets, changes or removes (null) my reaction; the UI updates at once and rolls back on error. */
export function useSetReaction(target: TargetRef) {
  const queryClient = useQueryClient();
  const userId = useUserId();
  const key = reactionKeys.target(target);

  return useMutation({
    mutationFn: async (kind: string | null) => {
      const { error } = await supabase.rpc('set_reaction', {
        p_group_id: target.groupId,
        p_target_type: target.type,
        p_target_id: target.id,
        // The generated types do not know these parameters may be null.
        p_target_index: (target.index ?? null) as number,
        p_kind: kind as string,
      });
      if (error) throw error;
    },
    onMutate: async (kind) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ReactionSummary>(key);
      if (previous) {
        const others = previous.reactions.filter((reaction) => reaction.userId !== userId);
        queryClient.setQueryData<ReactionSummary>(key, {
          reactions: kind ? [...others, { userId, kind }] : others,
          mine: kind,
        });
      }
      return { previous };
    },
    onError: (_error, _kind, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}
