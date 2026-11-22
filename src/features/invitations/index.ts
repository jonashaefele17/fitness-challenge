import type { PlanSocialSlots } from '@/features/training';
import { useInvitationsRealtime, useInvite } from './api/useInvitationActions';
import { useJoinedPlans } from './api/useJoinedPlans';
import { usePlanPeople } from './api/useParticipation';
import { InviteField } from './components/InviteField';
import { PlanInvitations } from './components/PlanInvitations';

/** Plugs invitations into training's plan slots (composed in the app). */
export const planSocialSlots: PlanSocialSlots = {
  useJoinedPlans,
  usePlanPeople,
  Detail: PlanInvitations,
  InviteField,
  useInvite,
};

export { useInvitationsRealtime };
