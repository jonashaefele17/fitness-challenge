export const trainingKeys = {
  all: (userId: string) => ['training', userId] as const,
  types: (userId: string) => [...trainingKeys.all(userId), 'types'] as const,
  active: (userId: string) => [...trainingKeys.all(userId), 'active'] as const,
  search: (userId: string, query: string) =>
    [...trainingKeys.all(userId), 'exercise-search', query] as const,
  previous: (userId: string, exerciseId: string) =>
    [...trainingKeys.all(userId), 'previous', exerciseId] as const,
  trend: (userId: string, exerciseId: string) =>
    [...trainingKeys.all(userId), 'trend', exerciseId] as const,
  muscles: () => ['training', 'muscle-groups'] as const,
};
