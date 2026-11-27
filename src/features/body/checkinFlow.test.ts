import { describe, expect, it } from 'vitest';
import {
  answersChanged,
  canSaveCheckin,
  checkinSteps,
  checkinValues,
  initialAnswers,
  kindHistory,
  measurementRows,
  measureSteps,
  photoPlan,
  previousValues,
  stepResult,
  suggestedValues,
  summaryRows,
  wheelValue,
} from './checkinFlow';
import type {
  BodyCheckin,
  BodyPhoto,
  MeasurementKind,
  MeasurementStat,
  MeasurementValues,
} from './types';

const kind = (key: string, sort: number): MeasurementKind => ({
  key,
  label: key.toUpperCase(),
  hint: '',
  unit: 'cm',
  step: 0.5,
  sort,
  imagePath: null,
  startValue: 80,
});
const kinds = [kind('bauch', 1), kind('taille', 2), kind('brust', 3)];

const checkin = (
  id: string,
  onDate: string,
  values: MeasurementValues,
  skipped = false,
  photos: BodyPhoto[] = [],
): BodyCheckin => ({
  id,
  onDate,
  skipped,
  values,
  photos,
  createdAt: '2026-11-01T08:00:00Z',
  updatedAt: '2026-11-01T08:00:00Z',
});

const stat = (key: string): MeasurementStat => ({
  kind: key,
  latestValue: 84.5,
  latestOn: '2026-11-01',
  previousValue: null,
  previousOn: null,
  firstValue: 84.5,
  firstOn: '2026-11-01',
  changeSincePrevious: null,
  changeSinceFirst: null,
  valueCount: 1,
});

describe('checkinSteps', () => {
  it('asks the visible kinds in catalogue order, then the photos, the summary last', () => {
    const steps = checkinSteps(kinds, ['taille']);
    expect(steps.map((s) => (s.type === 'measure' ? s.kind.key : s.type))).toEqual([
      'bauch',
      'brust',
      'photos',
      'summary',
    ]);
    expect(measureSteps(steps).map((k) => k.key)).toEqual(['bauch', 'brust']);
  });

  it('is only the photos and the summary when every kind is hidden', () => {
    expect(checkinSteps(kinds, ['bauch', 'taille', 'brust'])).toEqual([
      { type: 'photos' },
      { type: 'summary' },
    ]);
  });
});

describe('suggestedValues', () => {
  const list = [
    checkin('c3', '2026-11-20', { bauch: 84 }),
    checkin('c2', '2026-10-20', {}, true),
    checkin('c1', '2026-09-20', { bauch: 86, taille: 80 }),
  ];

  it('offers the latest value of each kind on or before the day', () => {
    expect(suggestedValues(list, '2026-11-27')).toEqual({
      bauch: { value: 84, onDate: '2026-11-20' },
      taille: { value: 80, onDate: '2026-09-20' },
    });
    expect(suggestedValues(list, '2026-11-20').bauch?.value).toBe(84);
    expect(suggestedValues(list, '2026-10-01').bauch?.value).toBe(86);
  });

  it('before all check-ins, offers the nearest later one', () => {
    expect(suggestedValues(list, '2026-01-01').bauch).toEqual({ value: 86, onDate: '2026-09-20' });
  });

  it('offers nothing without check-ins', () => {
    expect(suggestedValues([], '2026-11-27')).toEqual({});
  });
});

describe('previousValues', () => {
  it('takes the latest earlier value per kind, not the day itself', () => {
    const list = [
      checkin('c3', '2026-11-20', { bauch: 84 }),
      checkin('c1', '2026-09-20', { bauch: 86, taille: 80 }),
    ];
    expect(previousValues(list, '2026-11-20')).toEqual({ bauch: 86, taille: 80 });
    expect(previousValues(list, '2026-11-21')).toEqual({ bauch: 84, taille: 80 });
    expect(previousValues(list, '2026-09-20')).toEqual({});
  });
});

describe('stepResult', () => {
  it('"Weiter" takes my value, else the suggested one', () => {
    expect(stepResult(83.5, 84, 'next')).toBe(83.5);
    expect(stepResult(undefined, 84, 'next')).toBe(84);
    // Left out before, now confirmed: the suggestion shown again counts.
    expect(stepResult(null, 84, 'next')).toBe(84);
  });

  it('"Weiter" without anything shown leaves the kind out', () => {
    expect(stepResult(undefined, undefined, 'next')).toBeNull();
  });

  it('"Überspringen" always leaves it out', () => {
    expect(stepResult(83.5, 84, 'skip')).toBeNull();
  });
});

describe('wheelValue', () => {
  it('shows my value as confirmed, otherwise the suggestion greyed', () => {
    expect(wheelValue(83.5, 84)).toEqual({ value: 83.5, suggested: false });
    expect(wheelValue(undefined, 84)).toEqual({ value: 84, suggested: true });
    expect(wheelValue(null, 84)).toEqual({ value: 84, suggested: true });
    expect(wheelValue(undefined, undefined)).toEqual({ value: null, suggested: true });
  });
});

describe('answers and values', () => {
  const steps = checkinSteps(kinds, ['brust']);

  it('starts empty for a new check-in and from the values of an existing one', () => {
    expect(initialAnswers(null, steps)).toEqual({});
    expect(initialAnswers(checkin('c1', '2026-11-01', { bauch: 84 }), steps)).toEqual({
      bauch: 84,
      taille: null,
    });
  });

  it('saves the answered kinds and keeps values of kinds hidden since', () => {
    const existing = checkin('c1', '2026-11-01', { bauch: 84, taille: 80, brust: 100 });
    expect(checkinValues(steps, { bauch: 83.5, taille: null }, existing)).toEqual({
      bauch: 83.5,
      brust: 100,
    });
    expect(checkinValues(steps, { bauch: 83.5 }, null)).toEqual({ bauch: 83.5 });
  });

  it('notices entered or changed values, not skipped ones', () => {
    expect(answersChanged({}, { bauch: null })).toBe(false);
    expect(answersChanged({}, { bauch: 84 })).toBe(true);
    expect(answersChanged({ bauch: 84 }, { bauch: 84 })).toBe(false);
    expect(answersChanged({ bauch: 84 }, { bauch: null })).toBe(true);
  });
});

describe('summaryRows', () => {
  it('lists every measurement with its value and the change since the previous one', () => {
    const steps = checkinSteps(kinds, []);
    const rows = summaryRows(steps, { bauch: 83.5, taille: null, brust: 100 }, { bauch: 84.5 });
    expect(rows.map((r) => [r.kind.key, r.value, r.change])).toEqual([
      ['bauch', 83.5, -1],
      ['taille', null, null],
      ['brust', 100, null],
    ]);
  });
});

describe('overview rows', () => {
  it('lists visible kinds that have values, in catalogue order', () => {
    const rows = measurementRows(kinds, ['taille'], [stat('brust'), stat('taille'), stat('bauch')]);
    expect(rows.map((r) => r.kind.key)).toEqual(['bauch', 'brust']);
  });

  it('gives a kind its values from the check-ins, oldest first', () => {
    const list = [
      checkin('c3', '2026-11-20', { bauch: 84 }),
      checkin('c2', '2026-10-20', {}, true),
      checkin('c1', '2026-09-20', { bauch: 86, taille: 80 }),
    ];
    expect(kindHistory(list, 'bauch')).toEqual([
      { onDate: '2026-09-20', value: 86, checkinId: 'c1' },
      { onDate: '2026-11-20', value: 84, checkinId: 'c3' },
    ]);
  });
});

describe('photos in the flow', () => {
  const photo = (id: string, pose: string): BodyPhoto => ({
    id,
    checkinId: 'c1',
    pose,
    path: `u/c1/${pose}-${id}.jpg`,
    thumbPath: `u/c1/${pose}-${id}-thumb.jpg`,
    width: 1200,
    height: 1600,
    bytes: 300_000,
    createdAt: '2026-11-01T08:00:00Z',
  });
  const picked = new Blob(['x'], { type: 'image/jpeg' });
  const front = photo('p1', 'front');
  const side = photo('p2', 'side');
  const steps = checkinSteps(kinds, []);

  it('plans uploads, removals and how many photos remain', () => {
    expect(photoPlan([front, side], {})).toEqual({ add: [], remove: [], photos: 2 });
    expect(photoPlan([front, side], { front: picked, side: null, back: picked })).toEqual({
      add: [
        { pose: 'front', file: picked },
        { pose: 'back', file: picked },
      ],
      remove: [side],
      photos: 2,
    });
    // Removing a pose without a photo does nothing.
    expect(photoPlan([], { back: null })).toEqual({ add: [], remove: [], photos: 0 });
  });

  it('saves with photos only, but not with nothing', () => {
    expect(canSaveCheckin(steps, {}, null)).toBe(false);
    expect(canSaveCheckin(steps, {}, null, { front: picked })).toBe(true);
    expect(canSaveCheckin(steps, { bauch: 84 }, null)).toBe(true);
    const withPhotos = checkin('c1', '2026-11-01', {}, false, [front]);
    expect(canSaveCheckin(steps, {}, withPhotos)).toBe(true);
    expect(canSaveCheckin(steps, {}, withPhotos, { front: null })).toBe(false);
    expect(canSaveCheckin(steps, {}, withPhotos, { front: null, side: picked })).toBe(true);
  });

  it('notices a new picture or a removed photo', () => {
    expect(answersChanged({}, {}, {}, [front])).toBe(false);
    expect(answersChanged({}, {}, { front: picked }, [])).toBe(true);
    expect(answersChanged({}, {}, { front: null }, [front])).toBe(true);
    expect(answersChanged({}, {}, { side: null }, [front])).toBe(false);
  });
});
