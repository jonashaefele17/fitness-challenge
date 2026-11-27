import { describe, expect, it } from 'vitest';
import {
  clampPercent,
  clampZoom,
  defaultComparePair,
  defaultComparePose,
  fittedSize,
  photoDeleteTarget,
  previousPosePhotos,
  shownPhotos,
  ZOOM_MAX,
  zoomAround,
} from './photoView';
import type { BodyCheckin, BodyPhoto } from './types';

const photo = (id: string, checkinId: string, pose: string): BodyPhoto => ({
  id,
  checkinId,
  pose,
  path: `u/${checkinId}/${pose}-${id}.jpg`,
  thumbPath: `u/${checkinId}/${pose}-${id}-thumb.jpg`,
  width: 1200,
  height: 1600,
  bytes: 300_000,
  createdAt: '2026-11-01T08:00:00Z',
});

const checkin = (
  id: string,
  onDate: string,
  values: Record<string, number> = {},
  photos: BodyPhoto[] = [],
): BodyCheckin => ({
  id,
  onDate,
  skipped: false,
  values,
  photos,
  createdAt: '2026-11-01T08:00:00Z',
  updatedAt: '2026-11-01T08:00:00Z',
});

describe('previousPosePhotos', () => {
  const sep = checkin('c1', '2026-09-01', {}, [
    photo('p1', 'c1', 'front'),
    photo('p2', 'c1', 'back'),
  ]);
  const oct = checkin('c2', '2026-10-01', { bauch: 80 }, [photo('p3', 'c2', 'front')]);
  const nov = checkin('c3', '2026-11-01', {}, [photo('p4', 'c3', 'front')]);

  it('takes per pose the latest check-in before the day that has it', () => {
    const result = previousPosePhotos([nov, sep, oct], '2026-10-15');
    expect(result.front?.photo.id).toBe('p3');
    expect(result.front?.onDate).toBe('2026-10-01');
    expect(result.back?.photo.id).toBe('p2');
    expect(result.side).toBeUndefined();
  });

  it('leaves out the check-in being edited and anything on or after the day', () => {
    const result = previousPosePhotos([nov, sep, oct], '2026-10-01', 'c2');
    expect(result.front?.photo.id).toBe('p1');
  });

  it('is empty without earlier photos', () => {
    expect(previousPosePhotos([sep], '2026-09-01')).toEqual({});
  });
});

describe('shownPhotos', () => {
  const poses = [
    { key: 'front', label: 'Vorne', sort: 10 },
    { key: 'side', label: 'Seite', sort: 20 },
    { key: 'back', label: 'Hinten', sort: 30 },
  ];
  const front = photo('p1', 'c1', 'front');
  const back = photo('p2', 'c1', 'back');

  it('shows new pictures, kept photos and leaves out removed ones, in pose order', () => {
    const picked = new Blob(['x']);
    const shown = shownPhotos(poses, [back, front], { side: picked, back: null });
    expect(shown.map((s) => s.pose.key)).toEqual(['front', 'side']);
    expect(shown[0]?.photo).toBe(front);
    expect(shown[1]?.blob).toBe(picked);
  });

  it('puts a new picture in place of the kept one', () => {
    const picked = new Blob(['x']);
    const shown = shownPhotos(poses, [front], { front: picked });
    expect(shown).toEqual([{ pose: poses[0], blob: picked }]);
  });
});

describe('photoDeleteTarget', () => {
  it('deletes the check-in with its last photo when it has no measurements', () => {
    const only = photo('p1', 'c1', 'front');
    expect(photoDeleteTarget(checkin('c1', '2026-11-01', {}, [only]), only)).toBe('checkin');
  });

  it('deletes only the photo when others are left or there are measurements', () => {
    const a = photo('p1', 'c1', 'front');
    const b = photo('p2', 'c1', 'side');
    expect(photoDeleteTarget(checkin('c1', '2026-11-01', {}, [a, b]), a)).toBe('photo');
    expect(photoDeleteTarget(checkin('c1', '2026-11-01', { bauch: 80 }, [a]), a)).toBe('photo');
  });
});

describe('comparing defaults', () => {
  const a = checkin('a', '2026-09-01', {}, [photo('p1', 'a', 'side')]);
  const b = checkin('b', '2026-10-01', {}, [photo('p2', 'b', 'front'), photo('p3', 'b', 'side')]);
  const c = checkin('c', '2026-11-01', {}, [photo('p4', 'c', 'front')]);

  it('pairs the oldest with the newest', () => {
    expect(defaultComparePair([c, a, b])).toEqual({ beforeId: 'a', afterId: 'c' });
    expect(defaultComparePair([a])).toBeNull();
  });

  it('picks the first pose both have, else one either has', () => {
    const poses = ['front', 'side', 'back'];
    expect(defaultComparePose(poses, a, b)).toBe('side');
    expect(defaultComparePose(poses, b, c)).toBe('front');
    expect(defaultComparePose(poses, a, c)).toBe('front');
    expect(defaultComparePose(poses, undefined, undefined)).toBe('front');
  });

  it('keeps the slider within 0 … 100', () => {
    expect(clampPercent(-5)).toBe(0);
    expect(clampPercent(42)).toBe(42);
    expect(clampPercent(120)).toBe(100);
  });
});

describe('zoom', () => {
  const viewport = { width: 400, height: 800 };
  const fitted = fittedSize({ width: 1200, height: 1600 }, viewport);

  it('fits the picture into the viewport', () => {
    expect(fitted.width).toBe(400);
    expect(fitted.height).toBeCloseTo(533.33, 1);
  });

  it('keeps the scale between 1 and the maximum and the picture on screen', () => {
    expect(clampZoom({ scale: 0.5, x: 50, y: 50 }, fitted, viewport)).toEqual({
      scale: 1,
      x: 0,
      y: 0,
    });
    const big = clampZoom({ scale: 10, x: 10_000, y: -10_000 }, fitted, viewport);
    expect(big.scale).toBe(ZOOM_MAX);
    // 400 × 4 = 1600 wide: 600 to either side.
    expect(big.x).toBe(600);
    // 533 × 4 = 2133 high in an 800 viewport: 666.7 up or down.
    expect(big.y).toBeCloseTo(-666.67, 1);
  });

  it('keeps the point under the fingers in place', () => {
    const at = { x: 100, y: 0 };
    const next = zoomAround({ scale: 1, x: 0, y: 0 }, 2, at, fitted, viewport);
    // The content point at 100 px right of the centre stays at 100: x = 100 - 100 · 2.
    expect(next).toEqual({ scale: 2, x: -100, y: 0 });
    expect(zoomAround(next, 1, at, fitted, viewport)).toEqual({ scale: 1, x: 0, y: 0 });
  });
});
