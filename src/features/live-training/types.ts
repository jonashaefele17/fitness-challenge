/** A plan date of someone else I take part in, today. */
export interface LiveToday {
  planId: string;
  /** The plan date as planned. */
  planOn: string;
  ownerId: string;
  /** "18:00" */
  startTime: string | null;
  typeName: string;
  typeIcon: string;
  focusName: string | null;
  /** Someone trains it right now. */
  running: boolean;
  /** Who trains it right now. */
  memberIds: string[];
  /** I train it (or trained it) already. */
  mine: boolean;
}

/** The done sets of one person at one shared exercise. */
export interface PeerSets {
  /** My item of that exercise. */
  itemId: string;
  userId: string;
  sets: {
    weightKg: number | null;
    reps: number | null;
    durationSeconds: number | null;
    isWarmup: boolean;
  }[];
}
