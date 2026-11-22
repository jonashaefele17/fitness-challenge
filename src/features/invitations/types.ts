/** Someone's place in a plan (the whole plan; a series included). */
export interface Participant {
  planId: string;
  userId: string;
  groupId: string;
  /** invited | accepted | maybe | declined | requested ("Ich komm mit", not answered yet) */
  status: 'invited' | 'accepted' | 'maybe' | 'declined' | 'requested';
}

/** An answer for one date (overrides the answer for the whole plan), or a proposal. */
export interface DateResponse {
  planId: string;
  userId: string;
  /** The date as planned. */
  onDate: string;
  status: 'accepted' | 'maybe' | 'declined' | 'proposed';
  proposedDate: string | null;
  /** "19:00" */
  proposedTime: string | null;
}

export interface Participation {
  participants: Participant[];
  responses: DateResponse[];
}

export type Answer = 'accepted' | 'maybe' | 'declined';
