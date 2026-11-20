import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUserId } from '@/features/auth';
import { groupKeys } from '@/features/groups';
import { supabase } from '@/shared/lib/supabase';
import { targetKey, type TargetRef } from '@/shared/types/target';
import type { Comment, CommentStats, PostCommentInput } from '../types';

export const commentKeys = {
  all: (groupId: string) => [...groupKeys.scope(groupId), 'comments'] as const,
  stats: (target: TargetRef) => [...commentKeys.all(target.groupId), 'stats', ...targetKey(target)],
  thread: (target: TargetRef) => [
    ...commentKeys.all(target.groupId),
    'thread',
    ...targetKey(target),
  ],
};

const emptyStats: CommentStats = { total: 0, unread: 0, lastBody: null, lastAuthorId: null };

/** Count, unread count and latest comment for one object (speech bubble + preview line). */
export function useCommentStats(target: TargetRef) {
  return useQuery({
    queryKey: commentKeys.stats(target),
    queryFn: async (): Promise<CommentStats> => {
      const { data, error } = await supabase.rpc('comment_stats', {
        p_group_id: target.groupId,
        p_target_type: target.type,
        p_target_ids: [target.id],
      });
      if (error) throw error;
      // The generated type marks target_index as non-null, but it is null for whole objects.
      const row = data.find((r) => (r.target_index as number | null) === (target.index ?? null));
      if (!row) return emptyStats;
      return {
        total: row.total,
        unread: row.unread,
        lastBody: row.last_body,
        lastAuthorId: row.last_author_id,
      };
    },
  });
}

/** All comments on one object, oldest first (replies are grouped by the component). */
export function useThread(target: TargetRef, { live }: { live: boolean }) {
  return useQuery({
    queryKey: commentKeys.thread(target),
    refetchInterval: live ? 10_000 : false,
    queryFn: async (): Promise<Comment[]> => {
      const query = supabase
        .from('comments')
        .select(
          'id, parent_id, author_id, body, created_at, edited_at, deleted_at, comment_mentions(user_id)',
        )
        .eq('group_id', target.groupId)
        .eq('target_type', target.type)
        .eq('target_id', target.id)
        .order('created_at', { ascending: true });
      const index = target.index ?? null;
      const { data, error } = await (index === null
        ? query.is('target_index', null)
        : query.eq('target_index', index));
      if (error) throw error;
      return data.map((row) => ({
        id: row.id,
        parentId: row.parent_id,
        authorId: row.author_id,
        body: row.body,
        createdAt: row.created_at,
        editedAt: row.edited_at,
        deletedAt: row.deleted_at,
        mentionIds: row.comment_mentions.map((m) => m.user_id),
      }));
    },
  });
}

/** Posts a comment; it shows up immediately and is replaced by the saved one. */
export function usePostComment(target: TargetRef) {
  const queryClient = useQueryClient();
  const userId = useUserId();
  const threadKey = commentKeys.thread(target);

  return useMutation({
    mutationFn: async ({ body, parentId, mentionIds }: PostCommentInput) => {
      const { data, error } = await supabase.rpc('post_comment', {
        p_group_id: target.groupId,
        p_target_type: target.type,
        p_target_id: target.id,
        p_body: body,
        ...(target.index !== undefined &&
          target.index !== null && { p_target_index: target.index }),
        ...(parentId && { p_parent_id: parentId }),
        p_mentions: mentionIds,
      });
      if (error) throw error;
      return data;
    },
    onMutate: async ({ body, parentId, mentionIds }) => {
      await queryClient.cancelQueries({ queryKey: threadKey });
      const previous = queryClient.getQueryData<Comment[]>(threadKey);
      const optimistic: Comment = {
        id: `pending-${Date.now().toString()}`,
        parentId: parentId ?? null,
        authorId: userId,
        body: body.trim(),
        createdAt: new Date().toISOString(),
        editedAt: null,
        deletedAt: null,
        mentionIds,
        pending: true,
      };
      queryClient.setQueryData<Comment[]>(threadKey, [...(previous ?? []), optimistic]);
      return { previous };
    },
    onError: (_error, _input, context) => {
      queryClient.setQueryData(threadKey, context?.previous);
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: threadKey }),
        queryClient.invalidateQueries({ queryKey: commentKeys.stats(target) }),
      ]),
  });
}

/** Edit, soft-delete or restore one of my comments (optimistic). */
export function useUpdateComment(target: TargetRef) {
  const queryClient = useQueryClient();
  const threadKey = commentKeys.thread(target);

  return useMutation({
    mutationFn: async ({
      id,
      changes,
    }: {
      id: string;
      changes: { body?: string; deletedAt?: string | null };
    }) => {
      const { error } = await supabase
        .from('comments')
        .update({
          ...(changes.body !== undefined && { body: changes.body.trim() }),
          ...(changes.deletedAt !== undefined && { deleted_at: changes.deletedAt }),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, changes }) => {
      await queryClient.cancelQueries({ queryKey: threadKey });
      const previous = queryClient.getQueryData<Comment[]>(threadKey);
      queryClient.setQueryData<Comment[]>(
        threadKey,
        previous?.map((comment) =>
          comment.id === id
            ? {
                ...comment,
                ...(changes.body !== undefined && {
                  body: changes.body.trim(),
                  editedAt: new Date().toISOString(),
                }),
                ...(changes.deletedAt !== undefined && { deletedAt: changes.deletedAt }),
              }
            : comment,
        ),
      );
      return { previous };
    },
    onError: (_error, _input, context) => {
      queryClient.setQueryData(threadKey, context?.previous);
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: threadKey }),
        queryClient.invalidateQueries({ queryKey: commentKeys.stats(target) }),
      ]),
  });
}

export function useMarkThreadRead(target: TargetRef) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('mark_thread_read', {
        p_group_id: target.groupId,
        p_target_type: target.type,
        p_target_id: target.id,
        ...(target.index !== undefined &&
          target.index !== null && { p_target_index: target.index }),
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: commentKeys.stats(target) }),
  });
}
