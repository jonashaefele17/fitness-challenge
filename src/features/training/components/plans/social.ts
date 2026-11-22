import { createContext, type ComponentType } from 'react';
import type { PersonColorKey } from '@/shared/design-tokens';
import type { PlanOccurrence } from '../../types';

/** How someone stands to one date of a plan. */
export type PlanAnswer = 'accepted' | 'maybe' | 'open' | 'proposed' | 'declined';

/** Someone taking part in a plan date (the owner too, always "accepted"). */
export interface PlanPerson {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  color: PersonColorKey;
  answer: PlanAnswer;
  owner: boolean;
}

/**
 * Slots for the social layer of plans (invitations). The app plugs them in from a social
 * module; training never knows about groups, and without a provider plans are personal only.
 */
export interface PlanSocialSlots {
  /** Other people's plan dates I take part in, for my own calendar (range as for plans). */
  useJoinedPlans: (range: { from: Date; to: Date }) => PlanOccurrence[];
  /** Who takes part in the given plan dates; returns a lookup per date. */
  usePlanPeople: (plans: PlanOccurrence[]) => (plan: PlanOccurrence) => PlanPerson[];
  /** In a date's detail: who takes part, answers, inviting, "Ich komm mit". */
  Detail: ComponentType<{ plan: PlanOccurrence }> | null;
  /** In the form of a new plan: whom to invite. */
  InviteField: ComponentType<{ value: string[]; onChange: (userIds: string[]) => void }> | null;
  /** Invites people to a just saved plan. */
  useInvite: () => (planId: string, userIds: string[]) => Promise<void>;
}

const nobody: PlanPerson[] = [];

export const PlanSocialContext = createContext<PlanSocialSlots>({
  useJoinedPlans: () => [],
  usePlanPeople: () => () => nobody,
  Detail: null,
  InviteField: null,
  useInvite: () => () => Promise.resolve(),
});

/** People to show with a date: everyone but me who has not said no. */
export function companions(people: PlanPerson[], userId: string): PlanPerson[] {
  return people.filter((person) => person.id !== userId && person.answer !== 'declined');
}

const answerLabel: Record<PlanAnswer, string> = {
  accepted: 'kommt',
  maybe: 'vielleicht',
  open: 'noch offen',
  proposed: 'schlägt eine andere Zeit vor',
  declined: 'kommt nicht',
};

/** "kommt", "vielleicht", "noch offen" … */
export function answerText(answer: PlanAnswer): string {
  return answerLabel[answer];
}
