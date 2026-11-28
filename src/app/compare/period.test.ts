import { describe, expect, it } from 'vitest';
import type { Season } from '@/features/seasons';
import { comparePeriodRange, periodSeason, shownPeriod, shownWhat } from './period';

const season = (phase: Season['phase'], startsOn = '2026-11-02', endsOn = '2027-01-24') =>
  ({ phase, startsOn, endsOn }) as Season;

describe('periodSeason', () => {
  it('is the season once it has started, running or ended', () => {
    expect(periodSeason(season('running'))?.phase).toBe('running');
    expect(periodSeason(season('ended'))?.phase).toBe('ended');
  });

  it('is nothing before the start, when cancelled or without a season', () => {
    expect(periodSeason(season('setup'))).toBeNull();
    expect(periodSeason(season('announced'))).toBeNull();
    expect(periodSeason(season('cancelled'))).toBeNull();
    expect(periodSeason(null)).toBeNull();
    expect(periodSeason(undefined)).toBeNull();
  });
});

describe('shownPeriod', () => {
  it('defaults to the season while one runs, else to 4 weeks', () => {
    expect(shownPeriod(null, season('running'))).toBe('season');
    expect(shownPeriod(null, season('ended'))).toBe('4w');
    expect(shownPeriod(null, null)).toBe('4w');
  });

  it('keeps what was chosen; "Saison" without a season falls back to 4 weeks', () => {
    expect(shownPeriod('3m', season('running'))).toBe('3m');
    expect(shownPeriod('season', season('ended'))).toBe('season');
    expect(shownPeriod('season', null)).toBe('4w');
  });
});

describe('comparePeriodRange', () => {
  it('runs a season from its start up to today', () => {
    expect(comparePeriodRange('season', '2026-11-28', season('running'))).toEqual({
      from: '2026-11-02',
      to: '2026-11-28',
    });
  });

  it('ends an ended season on its end date', () => {
    expect(
      comparePeriodRange('season', '2026-11-28', season('ended', '2026-09-01', '2026-10-31')),
    ).toEqual({ from: '2026-09-01', to: '2026-10-31' });
  });

  it('counts the fixed periods back from today', () => {
    expect(comparePeriodRange('4w', '2026-11-28', null)).toEqual({
      from: '2026-11-01',
      to: '2026-11-28',
    });
    expect(comparePeriodRange('3m', '2026-11-28', null)).toEqual({
      from: '2026-08-29',
      to: '2026-11-28',
    });
    expect(comparePeriodRange('1y', '2026-11-28', null)).toEqual({
      from: '2025-11-29',
      to: '2026-11-28',
    });
  });
});

describe('shownWhat', () => {
  it('defaults to the overview while a season runs, else to Trainings', () => {
    expect(shownWhat(null, season('running'))).toBe('overview');
    expect(shownWhat(null, season('ended'))).toBe('trainings');
    expect(shownWhat(null, null)).toBe('trainings');
  });

  it('keeps what was chosen; the overview without a season falls back to Trainings', () => {
    expect(shownWhat('weight', season('running'))).toBe('weight');
    expect(shownWhat('overview', season('ended'))).toBe('overview');
    expect(shownWhat('overview', null)).toBe('trainings');
  });
});
