import { useQuery } from '@tanstack/react-query';
import { useUserId } from '@/features/auth';
import { useActiveGroup, useGroupMembers } from '@/features/groups';
import type { PlanAnswer, PlanOccurrence, PlanPerson, PlanRef } from '@/features/training';
import { supabase } from '@/shared/lib/supabase';
import type { DateResponse, Participant, Participation } from '../types';

export const invitationKeys = {
  all: (userId: string) => ['invitations', userId] as const,
  participation: (userId: string, planIds: string[]) =>
    [...invitationKeys.all(userId), 'participation', planIds] as const,
  joined: (userId: string) => [...invitationKeys.all(userId), 'joined'] as const,
};

const empty: Participation = { participants: [], responses: [] };

/** Who takes part in the given plans, and their answers per date. */
export function useParticipation(planIds: string[]) {
  const userId = useUserId();
  const ids = [...new Set(planIds)].sort();
  return useQuery({
    queryKey: invitationKeys.participation(userId, ids),
    enabled: ids.length > 0,
    placeholderData: (previous) => previous,
    queryFn: async (): Promise<Participation> => {
      const [participants, responses] = await Promise.all([
        supabase
          .from('plan_participants')
          .select('plan_id, user_id, group_id, status')
          .in('plan_id', ids),
        supabase
          .from('plan_responses')
          .select('plan_id, user_id, on_date, status, proposed_date, proposed_time')
          .in('plan_id', ids),
      ]);
      if (participants.error) throw participants.error;
      if (responses.error) throw responses.error;
      return {
        participants: participants.data.map((row): Participant => ({
          planId: row.plan_id,
          userId: row.user_id,
          groupId: row.group_id,
          status: row.status as Participant['status'],
        })),
        responses: responses.data.map((row): DateResponse => ({
          planId: row.plan_id,
          userId: row.user_id,
          onDate: row.on_date,
          status: row.status as DateResponse['status'],
          proposedDate: row.proposed_date,
          proposedTime: row.proposed_time ? row.proposed_time.slice(0, 5) : null,
        })),
      };
    },
  });
}

/** How a participant stands to one date: their answer for it, else for the whole plan. */
export function answerFor(
  data: Participation,
  plan: Pick<PlanOccurrence, 'planId' | 'planDate'>,
  participant: Participant,
): PlanAnswer {
  const response = data.responses.find(
    (r) =>
      r.planId === plan.planId && r.userId === participant.userId && r.onDate === plan.planDate,
  );
  if (response) return response.status;
  return participant.status === 'invited' || participant.status === 'requested'
    ? 'open'
    : participant.status;
}

/** Slot: who takes part in which date (the owner first), for calendar and day sheet. */
export function usePlanPeople(plans: PlanRef[]): (plan: PlanRef) => PlanPerson[] {
  const { group } = useActiveGroup();
  const members = useGroupMembers(group.id).data ?? [];
  const data = useParticipation(plans.map((plan) => plan.planId)).data ?? empty;

  return (plan) => {
    const taking = data.participants.filter(
      (p) => p.planId === plan.planId && p.status !== 'requested',
    );
    if (taking.length === 0) return [];
    const person = (id: string, answer: PlanAnswer, owner: boolean): PlanPerson[] => {
      const member = members.find((m) => m.userId === id);
      return member
        ? [
            {
              id,
              displayName: member.displayName,
              avatarUrl: member.avatarUrl,
              color: member.color,
              answer,
              owner,
            },
          ]
        : [];
    };
    return [
      ...person(plan.userId, 'accepted', true),
      ...taking.flatMap((p) => person(p.userId, answerFor(data, plan, p), false)),
    ];
  };
}
