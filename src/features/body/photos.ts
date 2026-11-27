import type { BodyCheckin, BodyPhoto, MeasurementKind, PhotoPose, WeightDay } from './types';

/** The private Storage bucket of the progress photos. */
export const PHOTO_BUCKET = 'body-photos';
/** Full size: 1600 px on the longer side, about 350 KB (the bucket takes up to 2 MB). */
export const PHOTO_FULL = { maxEdge: 1600, quality: 0.8, maxBytes: 600_000 } as const;
/** Thumbnail for lists: 320 px, about 20 KB. */
export const PHOTO_THUMB = { maxEdge: 320, quality: 0.7, maxBytes: 40_000 } as const;
/** Deleted photos keep their files this long (well past the undo toast), then are purged. */
export const PHOTO_PURGE_GRACE_MS = 2 * 60_000;
/** How long a signed URL is valid; the cache signs anew well before. */
export const PHOTO_URL_EXPIRY_S = 60 * 60;

/** Where the files of a photo go: <user>/<check-in>/<pose>-<photo id>.jpg (+ -thumb.jpg). */
export function photoFilePaths(
  userId: string,
  checkinId: string,
  pose: string,
  photoId: string,
): { path: string; thumbPath: string } {
  const base = `${userId}/${checkinId}/${pose}-${photoId}`;
  return { path: `${base}.jpg`, thumbPath: `${base}-thumb.jpg` };
}

/** The live photo of a pose on a check-in, if any. */
export function photoOfPose(
  checkin: Pick<BodyCheckin, 'photos'> | null | undefined,
  pose: string,
): BodyPhoto | undefined {
  return checkin?.photos.find((p) => p.pose === pose);
}

/** The photos of a check-in in pose order (front, side, back). */
export function photosInPoseOrder(
  photos: readonly BodyPhoto[],
  poses: readonly PhotoPose[],
): BodyPhoto[] {
  const sort = new Map(poses.map((p) => [p.key, p.sort]));
  return [...photos].sort(
    (a, b) =>
      (sort.get(a.pose) ?? Number.MAX_SAFE_INTEGER) - (sort.get(b.pose) ?? Number.MAX_SAFE_INTEGER),
  );
}

/** Check-ins that have photos, newest first (the photo row by date). */
export function checkinsWithPhotos(checkins: readonly BodyCheckin[]): BodyCheckin[] {
  return checkins
    .filter((c) => c.photos.length > 0)
    .sort((a, b) => b.onDate.localeCompare(a.onDate));
}

/** The list with a photo put on its check-in in place of the one with its id or pose. */
export function withPhoto(list: readonly BodyCheckin[], photo: BodyPhoto): BodyCheckin[] {
  return list.map((c) =>
    c.id === photo.checkinId
      ? {
          ...c,
          photos: [...c.photos.filter((p) => p.id !== photo.id && p.pose !== photo.pose), photo],
        }
      : c,
  );
}

/** The list without a photo. */
export function withoutPhoto(list: readonly BodyCheckin[], photoId: string): BodyCheckin[] {
  return list.map((c) =>
    c.photos.some((p) => p.id === photoId)
      ? { ...c, photos: c.photos.filter((p) => p.id !== photoId) }
      : c,
  );
}

// ---------------------------------------------------------------------------
// Comparing two check-ins
// ---------------------------------------------------------------------------

/**
 * My weight at a check-in: the 7-day trend of the latest day with entries on or before that
 * day, at most maxDaysBefore days earlier (a weigh-in weeks before says nothing about the
 * day). days: from useWeightDays(null, today), oldest first. null without one.
 */
export function weightAt(
  days: readonly WeightDay[],
  onDate: string,
  maxDaysBefore = 7,
): { trendKg: number; onDate: string } | null {
  const earliest = new Date(`${onDate}T12:00:00Z`);
  earliest.setUTCDate(earliest.getUTCDate() - maxDaysBefore);
  const from = earliest.toISOString().slice(0, 10);
  let found: WeightDay | null = null;
  for (const day of days) {
    if (day.onDate > onDate) break;
    if (day.onDate >= from) found = day;
  }
  return found ? { trendKg: found.trendKg, onDate: found.onDate } : null;
}

export interface CompareRow<T> {
  before: T | null;
  after: T | null;
  /** after − before (rounded to 0.1); null when one is missing. */
  change: number | null;
}

export interface CheckinComparison {
  weight: CompareRow<number>;
  /** Kinds at least one of the two has, in catalogue order. */
  measurements: (CompareRow<number> & { kind: MeasurementKind })[];
}

const change = (before: number | null, after: number | null) =>
  before === null || after === null ? null : Math.round((after - before) * 10) / 10;

/**
 * Two check-ins side by side (the earlier one first, whatever order they are given in):
 * weight (trend at each day, see weightAt) and each measurement with the change.
 */
export function compareCheckins(
  a: BodyCheckin,
  b: BodyCheckin,
  kinds: readonly MeasurementKind[],
  days: readonly WeightDay[],
): CheckinComparison {
  const [before, after] = a.onDate <= b.onDate ? [a, b] : [b, a];
  const wBefore = weightAt(days, before.onDate)?.trendKg ?? null;
  const wAfter = weightAt(days, after.onDate)?.trendKg ?? null;
  return {
    weight: { before: wBefore, after: wAfter, change: change(wBefore, wAfter) },
    measurements: [...kinds]
      .sort((x, y) => x.sort - y.sort)
      .flatMap((kind) => {
        const v1 = before.values[kind.key] ?? null;
        const v2 = after.values[kind.key] ?? null;
        if (v1 === null && v2 === null) return [];
        return [{ kind, before: v1, after: v2, change: change(v1, v2) }];
      }),
  };
}
