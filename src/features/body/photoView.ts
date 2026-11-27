import type { PhotoAnswers } from './checkinFlow';
import type { BodyCheckin, BodyPhoto, PhotoPose } from './types';

// ---------------------------------------------------------------------------
// The photos step: the reference picture of last time
// ---------------------------------------------------------------------------

/**
 * Per pose the photo of the latest check-in before `onDate` that has that pose (the one being
 * edited left out), so the person can match distance and posture.
 */
export function previousPosePhotos(
  checkins: readonly BodyCheckin[],
  onDate: string,
  excludeId: string | null = null,
): Record<string, { photo: BodyPhoto; onDate: string }> {
  const result: Record<string, { photo: BodyPhoto; onDate: string }> = {};
  const earlier = checkins
    .filter((c) => c.id !== excludeId && c.onDate < onDate)
    .sort((a, b) => a.onDate.localeCompare(b.onDate));
  for (const c of earlier) {
    for (const photo of c.photos) result[photo.pose] = { photo, onDate: c.onDate };
  }
  return result;
}

export interface ShownPhoto {
  pose: PhotoPose;
  /** A new picture, not uploaded yet. */
  blob?: Blob;
  /** The check-in's photo, kept. */
  photo?: BodyPhoto;
}

/** What the check-in will have per pose after saving, in pose order. */
export function shownPhotos(
  poses: readonly PhotoPose[],
  existing: readonly BodyPhoto[],
  changes: PhotoAnswers,
): ShownPhoto[] {
  return poses.flatMap((pose): ShownPhoto[] => {
    const answer = changes[pose.key];
    if (answer) return [{ pose, blob: answer }];
    const photo = answer === undefined ? existing.find((p) => p.pose === pose.key) : undefined;
    return photo ? [{ pose, photo }] : [];
  });
}

// ---------------------------------------------------------------------------
// Deleting from the viewer
// ---------------------------------------------------------------------------

/**
 * What deleting a photo does: just the photo, or – when it is the last photo of a check-in
 * without measurements – the whole check-in (an empty one would still count as done and
 * move the rhythm on). Either way one "Rückgängig" brings it back.
 */
export function photoDeleteTarget(checkin: BodyCheckin, photo: BodyPhoto): 'photo' | 'checkin' {
  const others = checkin.photos.filter((p) => p.id !== photo.id);
  return others.length === 0 && Object.keys(checkin.values).length === 0 ? 'checkin' : 'photo';
}

// ---------------------------------------------------------------------------
// Comparing
// ---------------------------------------------------------------------------

/** The pair to compare first: the oldest and the newest check-in with photos (ids). */
export function defaultComparePair(
  withPhotos: readonly BodyCheckin[],
): { beforeId: string; afterId: string } | null {
  if (withPhotos.length < 2) return null;
  const sorted = [...withPhotos].sort((a, b) => a.onDate.localeCompare(b.onDate));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return first && last ? { beforeId: first.id, afterId: last.id } : null;
}

/** The first pose (in the given order) both check-ins have; else the first either has. */
export function defaultComparePose(
  poses: readonly string[],
  a: BodyCheckin | undefined,
  b: BodyCheckin | undefined,
): string | undefined {
  const has = (c: BodyCheckin | undefined, pose: string) =>
    c?.photos.some((p) => p.pose === pose) ?? false;
  return (
    poses.find((pose) => has(a, pose) && has(b, pose)) ??
    poses.find((pose) => has(a, pose) || has(b, pose)) ??
    poses[0]
  );
}

/** Slider position in percent, kept within 0 … 100. */
export function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

// ---------------------------------------------------------------------------
// Zooming the large view (pinch, double tap, pan)
// ---------------------------------------------------------------------------

export interface Size {
  width: number;
  height: number;
}

/** translate(x, y) scale(scale) around the centre of the viewport. */
export interface ZoomState {
  scale: number;
  x: number;
  y: number;
}

export const ZOOM_NONE: ZoomState = { scale: 1, x: 0, y: 0 };
export const ZOOM_MAX = 4;
/** Where a double tap zooms to. */
export const ZOOM_DOUBLE_TAP = 2.5;

/** The size a picture is shown at when it fits the viewport (object-contain). */
export function fittedSize(image: Size, viewport: Size): Size {
  if (image.width <= 0 || image.height <= 0) return viewport;
  const scale = Math.min(viewport.width / image.width, viewport.height / image.height);
  return { width: image.width * scale, height: image.height * scale };
}

/** Keeps the scale within 1 … ZOOM_MAX and the picture from leaving gaps at its edges. */
export function clampZoom(state: ZoomState, fitted: Size, viewport: Size): ZoomState {
  const scale = Math.min(ZOOM_MAX, Math.max(1, state.scale));
  const maxX = Math.max(0, (fitted.width * scale - viewport.width) / 2);
  const maxY = Math.max(0, (fitted.height * scale - viewport.height) / 2);
  const clamp = (v: number, max: number) => (max === 0 ? 0 : Math.min(max, Math.max(-max, v)));
  return { scale, x: clamp(state.x, maxX), y: clamp(state.y, maxY) };
}

/**
 * Zooms to `scale` so that the point under `at` (relative to the viewport centre) stays
 * where it is, then clamps.
 */
export function zoomAround(
  state: ZoomState,
  scale: number,
  at: { x: number; y: number },
  fitted: Size,
  viewport: Size,
): ZoomState {
  const next = Math.min(ZOOM_MAX, Math.max(1, scale));
  const ratio = next / state.scale;
  return clampZoom(
    { scale: next, x: at.x - (at.x - state.x) * ratio, y: at.y - (at.y - state.y) * ratio },
    fitted,
    viewport,
  );
}
