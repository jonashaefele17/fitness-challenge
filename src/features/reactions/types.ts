/** One of the reactions to choose from (data: reaction_kinds). */
export interface ReactionKind {
  key: string;
  emoji: string;
}

export interface ReactionSummary {
  /** Who reacted how (one reaction per person). */
  reactions: { userId: string; kind: string }[];
  /** My reaction's kind, or null. */
  mine: string | null;
}
