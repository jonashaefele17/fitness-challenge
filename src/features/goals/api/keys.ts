export const goalKeys = {
  /** Everything of the goals module (invalidate after changes to trainings, weight, habits …). */
  all: (userId: string) => ['goals', userId] as const,
  /** The global catalogue (rarely changes). */
  metrics: (userId: string) => [...goalKeys.all(userId), 'metrics'] as const,
  /** personId: whose goals (default: mine). */
  lists: (userId: string, personId: string = userId) =>
    [...goalKeys.all(userId), 'list', personId] as const,
  list: (userId: string, personId: string, today: string, includeArchived: boolean) =>
    [...goalKeys.lists(userId, personId), today, includeArchived] as const,
  history: (userId: string, goalId: string, today: string) =>
    [...goalKeys.all(userId), 'history', goalId, today] as const,
  suggestion: (
    userId: string,
    metric: string,
    today: string,
    reference: readonly (string | null)[],
    reps: number | null,
  ) => [...goalKeys.all(userId), 'suggestion', metric, today, ...reference, reps] as const,
  referenceOptions: (userId: string, metric: string) =>
    [...goalKeys.all(userId), 'reference-options', metric] as const,
};
