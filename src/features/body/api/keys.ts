export const bodyKeys = {
  all: (userId: string) => ['body', userId] as const,
  scales: (userId: string) => [...bodyKeys.all(userId), 'scales'] as const,
  weighInsAll: (userId: string) => [...bodyKeys.all(userId), 'weigh-ins'] as const,
  /** from null: from the first entry ("Alles"). */
  weighIns: (userId: string, from: string | null, to: string) =>
    [...bodyKeys.weighInsAll(userId), from, to] as const,
  days: (userId: string, from: string | null, to: string) =>
    [...bodyKeys.all(userId), 'days', from, to] as const,
  /** personId: whose figures (default: mine). */
  summary: (userId: string, from: string | null, to: string, personId: string = userId) =>
    [...bodyKeys.all(userId), 'summary', from, to, personId] as const,
  progress: (userId: string, personId: string, from: string | null, to: string) =>
    [...bodyKeys.all(userId), 'progress', personId, from, to] as const,
  suggestion: (userId: string, scaleId: string) =>
    [...bodyKeys.all(userId), 'suggestion', scaleId] as const,
  settings: (userId: string) => [...bodyKeys.all(userId), 'settings'] as const,
  /** The global catalogue (rarely changes). */
  measurementKinds: (userId: string) => [...bodyKeys.all(userId), 'measurement-kinds'] as const,
  /** Everything computed from check-ins (invalidated together after a change). */
  checkinsAll: (userId: string) => [...bodyKeys.all(userId), 'checkins'] as const,
  /** The list includes each check-in's live photos. */
  checkins: (userId: string) => [...bodyKeys.checkinsAll(userId), 'list'] as const,
  photoPoses: (userId: string) => [...bodyKeys.all(userId), 'photo-poses'] as const,
  /**
   * Signed URLs of photo files (sorted paths). Outside bodyKeys.all on purpose: refreshing the
   * body data must not sign them anew (new URLs would load every picture again).
   */
  photoUrls: (userId: string, paths: readonly string[]) =>
    ['body-photo-urls', userId, ...paths] as const,
  checkinStatus: (userId: string, today: string) =>
    [...bodyKeys.checkinsAll(userId), 'status', today] as const,
  /** My weigh days and the due check-in in a range (follow the settings and check-ins). */
  dayMarkers: (userId: string, from: string, to: string, today: string) =>
    [...bodyKeys.checkinsAll(userId), 'day-markers', from, to, today] as const,
  measurementStats: (userId: string) => [...bodyKeys.checkinsAll(userId), 'stats'] as const,
  measurementHistory: (userId: string, kind: string) =>
    [...bodyKeys.checkinsAll(userId), 'history', kind] as const,
};
