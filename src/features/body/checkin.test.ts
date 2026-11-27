import { describe, expect, it } from 'vitest';
import {
  byNewestCheckin,
  checkinDueText,
  checkinOn,
  checkinRhythmSummary,
  formatCm,
  formatSignedCm,
  newCheckin,
  parseCm,
  visibleKinds,
} from './checkin';
import type { BodyCheckin, MeasurementKind } from './types';

const checkin = (id: string, onDate: string, skipped = false): BodyCheckin => ({
  id,
  onDate,
  skipped,
  values: skipped ? {} : { bauch: 90 },
  createdAt: '2026-11-01T08:00:00Z',
  updatedAt: '2026-11-01T08:00:00Z',
});

describe('cm', () => {
  it('formats with one decimal and a German comma', () => {
    expect(formatCm(84.5)).toBe('84,5');
    expect(formatCm(90)).toBe('90,0');
    expect(formatCm(null)).toBe('–');
  });

  it('formats a signed change', () => {
    expect(formatSignedCm(-1.5)).toBe('−1,5 cm');
    expect(formatSignedCm(0.5)).toBe('+0,5 cm');
    expect(formatSignedCm(0)).toBe('±0,0 cm');
    expect(formatSignedCm(null)).toBe('–');
  });

  it('parses input', () => {
    expect(parseCm('84,5')).toBe(84.5);
    expect(parseCm(' 84.5 ')).toBe(84.5);
    expect(parseCm('90')).toBe(90);
    expect(parseCm('84,55')).toBeNull();
    expect(parseCm('9')).toBeNull();
    expect(parseCm('301')).toBeNull();
    expect(parseCm('')).toBeNull();
  });
});

describe('due text', () => {
  it('words the days until the next Zwischenstand', () => {
    expect(checkinDueText({ daysUntil: null })).toBeNull();
    expect(checkinDueText({ daysUntil: 12 })).toBe('in 12 Tagen');
    expect(checkinDueText({ daysUntil: 1 })).toBe('morgen');
    expect(checkinDueText({ daysUntil: 0 })).toBe('heute fällig');
    expect(checkinDueText({ daysUntil: -1 })).toBe('seit gestern fällig');
    expect(checkinDueText({ daysUntil: -3 })).toBe('seit 3 Tagen fällig');
  });
});

describe('rhythm summary', () => {
  it('shows rhythm and time', () => {
    expect(checkinRhythmSummary(undefined)).toBe('Aus');
    expect(checkinRhythmSummary({ checkinEveryWeeks: null, checkinReminderAt: '08:00' })).toBe(
      'Aus',
    );
    expect(checkinRhythmSummary({ checkinEveryWeeks: 4, checkinReminderAt: '08:00' })).toBe(
      'Alle 4 Wochen · 08:00',
    );
    expect(checkinRhythmSummary({ checkinEveryWeeks: 1, checkinReminderAt: null })).toBe(
      'Jede Woche',
    );
  });
});

describe('check-ins', () => {
  const list = [checkin('a', '2026-10-01'), checkin('b', '2026-11-01', true)];

  it('finds the check-in of a day and sorts newest first', () => {
    expect(checkinOn(list, '2026-11-01')?.id).toBe('b');
    expect(checkinOn(list, '2026-11-02')).toBeUndefined();
    expect([...list].sort(byNewestCheckin).map((c) => c.id)).toEqual(['b', 'a']);
  });

  it('builds the save input: a new id, or the day’s check-in to undo to', () => {
    expect(newCheckin(list, '2026-12-01', { bauch: 88 }, () => 'new')).toEqual({
      input: { id: 'new', onDate: '2026-12-01', values: { bauch: 88 } },
      previous: null,
    });
    const update = newCheckin(list, '2026-11-01', { bauch: 88 }, () => 'new');
    expect(update.input.id).toBe('b');
    expect(update.previous?.skipped).toBe(true);
  });

  it('leaves out hidden kinds', () => {
    const kinds = ['bauch', 'taille', 'brust'].map((key, sort): MeasurementKind => ({
      key,
      label: key,
      hint: '',
      unit: 'cm',
      step: 0.5,
      sort,
      imagePath: null,
    }));
    expect(visibleKinds(kinds, ['taille']).map((k) => k.key)).toEqual(['bauch', 'brust']);
  });
});
