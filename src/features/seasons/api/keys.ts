import { groupKeys } from '@/features/groups';

/** Everything of a group's seasons sits under its group scope (rule 12). */
export const seasonKeys = {
  all: (groupId: string) => [...groupKeys.scope(groupId), 'seasons'] as const,
  lists: (groupId: string) => [...seasonKeys.all(groupId), 'list'] as const,
  list: (groupId: string, today: string) => [...seasonKeys.lists(groupId), today] as const,
  participants: (groupId: string, seasonId: string) =>
    [...seasonKeys.all(groupId), 'participants', seasonId] as const,
  goalLinks: (groupId: string, seasonId: string) =>
    [...seasonKeys.all(groupId), 'goal-links', seasonId] as const,
  habits: (groupId: string, seasonId: string, today: string) =>
    [...seasonKeys.all(groupId), 'habits', seasonId, today] as const,
  overview: (groupId: string, seasonId: string, today: string) =>
    [...seasonKeys.all(groupId), 'overview', seasonId, today] as const,
  progress: (groupId: string, seasonId: string, today: string) =>
    [...seasonKeys.all(groupId), 'progress', seasonId, today] as const,
  habitWeeks: (groupId: string, seasonId: string, today: string) =>
    [...seasonKeys.all(groupId), 'habit-weeks', seasonId, today] as const,
  strength: (groupId: string, seasonId: string, today: string) =>
    [...seasonKeys.all(groupId), 'strength', seasonId, today] as const,
  markers: (groupId: string, from: string, to: string) =>
    [...seasonKeys.all(groupId), 'markers', from, to] as const,
};
