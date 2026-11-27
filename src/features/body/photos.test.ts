import { describe, expect, it } from 'vitest';
import {
  checkinsWithPhotos,
  compareCheckins,
  photoFilePaths,
  photoOfPose,
  photosInPoseOrder,
  weightAt,
  withoutPhoto,
  withPhoto,
} from './photos';
import type { BodyCheckin, BodyPhoto, MeasurementKind, PhotoPose, WeightDay } from './types';

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

const poses: PhotoPose[] = [
  { key: 'front', label: 'Vorne', sort: 10 },
  { key: 'side', label: 'Seite', sort: 20 },
  { key: 'back', label: 'Hinten', sort: 30 },
];

describe('photoFilePaths', () => {
  it('puts both files into my folder of the check-in', () => {
    expect(photoFilePaths('u1', 'c1', 'front', 'p1')).toEqual({
      path: 'u1/c1/front-p1.jpg',
      thumbPath: 'u1/c1/front-p1-thumb.jpg',
    });
  });
});

describe('photos of a check-in', () => {
  const front = photo('p1', 'c1', 'front');
  const back = photo('p2', 'c1', 'back');
  const side = photo('p3', 'c1', 'side');

  it('finds the photo of a pose', () => {
    expect(photoOfPose(checkin('c1', '2026-11-01', {}, [front]), 'front')).toBe(front);
    expect(photoOfPose(checkin('c1', '2026-11-01', {}, [front]), 'side')).toBeUndefined();
    expect(photoOfPose(null, 'front')).toBeUndefined();
  });

  it('orders them by pose', () => {
    expect(photosInPoseOrder([back, front, side], poses)).toEqual([front, side, back]);
  });

  it('lists the check-ins with photos, newest first', () => {
    const list = [
      checkin('c1', '2026-10-01', {}, [front]),
      checkin('c2', '2026-12-01', { bauch: 80 }),
      checkin('c3', '2026-11-01', {}, [photo('p9', 'c3', 'front')]),
    ];
    expect(checkinsWithPhotos(list).map((c) => c.id)).toEqual(['c3', 'c1']);
  });

  it('puts a photo in place of the one of its pose, and takes one out', () => {
    const list = [checkin('c1', '2026-11-01', {}, [front, back]), checkin('c2', '2026-12-01')];
    const replaced = photo('p4', 'c1', 'front');
    expect(withPhoto(list, replaced)[0]?.photos).toEqual([back, replaced]);
    expect(withPhoto(list, replaced)[1]).toBe(list[1]);
    expect(withoutPhoto(list, 'p2')[0]?.photos).toEqual([front]);
  });
});

describe('weightAt', () => {
  const day = (onDate: string, trendKg: number): WeightDay => ({
    onDate,
    weightKg: trendKg,
    entries: 1,
    trendKg,
  });
  const days = [day('2026-10-20', 82), day('2026-11-01', 81.5), day('2026-11-03', 81)];

  it('takes the trend of the latest day on or before the check-in', () => {
    expect(weightAt(days, '2026-11-01')).toEqual({ trendKg: 81.5, onDate: '2026-11-01' });
    expect(weightAt(days, '2026-11-02')).toEqual({ trendKg: 81.5, onDate: '2026-11-01' });
    expect(weightAt(days, '2026-11-10')).toEqual({ trendKg: 81, onDate: '2026-11-03' });
  });

  it('nothing when the last weigh-in is more than a week before', () => {
    expect(weightAt(days, '2026-11-11')).toBeNull();
    expect(weightAt(days, '2026-10-19')).toBeNull();
    expect(weightAt([], '2026-11-01')).toBeNull();
  });
});

describe('compareCheckins', () => {
  const kind = (key: string, sort: number): MeasurementKind => ({
    key,
    label: key,
    hint: '',
    unit: 'cm',
    step: 0.5,
    sort,
    imagePath: null,
    startValue: 80,
  });
  const kinds = [kind('taille', 2), kind('bauch', 1), kind('brust', 3)];
  const days: WeightDay[] = [
    { onDate: '2026-10-01', weightKg: 82, entries: 1, trendKg: 82.3 },
    { onDate: '2026-11-01', weightKg: 80, entries: 1, trendKg: 80.1 },
  ];

  it('puts the earlier one first with weight, measurements and the changes', () => {
    const older = checkin('c1', '2026-10-01', { bauch: 90, taille: 85 });
    const newer = checkin('c2', '2026-11-01', { bauch: 88.5, brust: 100 });
    const result = compareCheckins(newer, older, kinds, days);
    expect(result.weight).toEqual({ before: 82.3, after: 80.1, change: -2.2 });
    expect(result.measurements.map((m) => [m.kind.key, m.before, m.after, m.change])).toEqual([
      ['bauch', 90, 88.5, -1.5],
      ['taille', 85, null, null],
      ['brust', null, 100, null],
    ]);
  });

  it('no weight change without a weigh-in near one of them', () => {
    const result = compareCheckins(
      checkin('c1', '2026-08-01'),
      checkin('c2', '2026-11-01'),
      kinds,
      days,
    );
    expect(result.weight).toEqual({ before: null, after: 80.1, change: null });
    expect(result.measurements).toEqual([]);
  });
});
