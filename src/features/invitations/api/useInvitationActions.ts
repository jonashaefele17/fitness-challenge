import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useUserId } from '@/features/auth';
import { useActiveGroup } from '@/features/groups';
import { trainingKeys } from '@/features/training';
import { useRealtimeInvalidation } from '@/shared/lib/realtime';
import { supabase } from '@/shared/lib/supabase';
import type { Answer, Participation } from '../types';
import { invitationKeys } from './useParticipation';

/** After every step: participation, and plans (a taken proposal moves a date). */
function useRefresh() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: invitationKeys.all(userId) }),
      queryClient.invalidateQueries({ queryKey: trainingKeys.all(userId) }),
    ]);
}

/** The owner sets who is invited (new people are told). */
export function useSetParticipants() {
  const { group } = useActiveGroup();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async ({ planId, userIds }: { planId: string; userIds: string[] }) => {
      const { error } = await supabase.rpc('set_plan_participants', {
        p_plan_id: planId,
        p_group_id: group.id,
        p_user_ids: userIds,
      });
      if (error) throw error;
    },
    onSettled: refresh,
  });
}

/** Slot: invite people to a just saved plan. */
export function useInvite() {
  const { mutateAsync } = useSetParticipants();
  return useCallback(
    (planId: string, userIds: string[]) => mutateAsync({ planId, userIds }),
    [mutateAsync],
  );
}

export interface RespondInput {
  planId: string;
  /** The planned date; null answers for the whole plan. */
  planDate: string | null;
  status: Answer | 'proposed';
  proposedDate?: string;
  proposedTime?: string;
}

/** My answer; shows at once, saved in the background. */
export function useRespond() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (input: RespondInput) => {
      const { error } = await supabase.rpc('respond_to_plan', {
        p_plan_id: input.planId,
        // null = the whole plan (the generated type does not know it may be null).
        p_on_date: input.planDate as string,
        p_status: input.status,
        ...(input.proposedDate && { p_proposed_date: input.proposedDate }),
        ...(input.proposedTime && { p_proposed_time: input.proposedTime }),
      });
      if (error) throw error;
    },
    onMutate: async (input) => {
      const prefix = [...invitationKeys.all(userId), 'participation'];
      await queryClient.cancelQueries({ queryKey: prefix });
      queryClient.setQueriesData<Participation>({ queryKey: prefix }, (data) => {
        if (!data) return data;
        if (input.planDate === null) {
          return {
            participants: data.participants.map((p) =>
              p.planId === input.planId && p.userId === userId
                ? { ...p, status: input.status === 'proposed' ? p.status : input.status }
                : p,
            ),
            responses: data.responses.filter(
              (r) => !(r.planId === input.planId && r.userId === userId),
            ),
          };
        }
        return {
          participants: data.participants,
          responses: [
            ...data.responses.filter(
              (r) =>
                !(r.planId === input.planId && r.userId === userId && r.onDate === input.planDate),
            ),
            {
              planId: input.planId,
              userId,
              onDate: input.planDate,
              status: input.status,
              proposedDate: input.proposedDate ?? null,
              proposedTime: input.proposedTime ?? null,
            },
          ],
        };
      });
    },
    onSettled: refresh,
  });
}

/** The owner takes a proposal: the date moves. */
export function useAcceptProposal() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (input: { planId: string; userId: string; planDate: string }) => {
      const { error } = await supabase.rpc('accept_plan_proposal', {
        p_plan_id: input.planId,
        p_user_id: input.userId,
        p_on_date: input.planDate,
      });
      if (error) throw error;
    },
    onSettled: refresh,
  });
}

/** "Ich komm mit" */
export function useRequestJoin() {
  const { group } = useActiveGroup();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (planId: string) => {
      const { error } = await supabase.rpc('request_to_join_plan', {
        p_plan_id: planId,
        p_group_id: group.id,
      });
      if (error) throw error;
    },
    onSettled: refresh,
  });
}

/** The owner lets someone come along, or not. */
export function useAnswerRequest() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (input: { planId: string; userId: string; accept: boolean }) => {
      const { error } = await supabase.rpc('answer_join_request', {
        p_plan_id: input.planId,
        p_user_id: input.userId,
        p_accept: input.accept,
      });
      if (error) throw error;
    },
    onSettled: refresh,
  });
}

/** Answers and invitations arrive live (mounted once by the app). */
export function useInvitationsRealtime() {
  const userId = useUserId();
  const queryKey = invitationKeys.all(userId);
  useRealtimeInvalidation({
    channel: `plan_participants:${userId}`,
    table: 'plan_participants',
    events: ['INSERT', 'UPDATE', 'DELETE'],
    queryKey,
  });
  useRealtimeInvalidation({
    channel: `plan_responses:${userId}`,
    table: 'plan_responses',
    events: ['INSERT', 'UPDATE', 'DELETE'],
    queryKey,
  });
}
