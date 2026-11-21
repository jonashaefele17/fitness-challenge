import { describe, expect, it } from 'vitest';
import { elapsedSeconds, formatDuration, formatKg, formatSet, summarize } from './format';
import type { WorkoutItem } from './types';

describe('formatting', () => {
  it('uses German decimals', () => {
    expect(formatKg(72.5)).toBe('72,5');
    expect(formatKg(null)).toBe('–');
  });

  it('formats durations', () => {
    expect(formatDuration(75)).toBe('1:15');
    expect(formatDuration(3725)).toBe('1:02:05');
  });

  it('formats sets per measure', () => {
    const set = { weightKg: 72.5, reps: 8, durationSeconds: null };
    expect(formatSet('weight_reps', set)).toBe('72,5 × 8');
    expect(formatSet('reps', { weightKg: null, reps: 12, durationSeconds: null })).toBe('12 Wdh.');
    expect(formatSet('reps', { weightKg: 10, reps: 6, durationSeconds: null })).toBe('+10 × 6');
    expect(formatSet('duration', { weightKg: null, reps: null, durationSeconds: 45 })).toBe('0:45');
  });
});

describe('elapsedSeconds', () => {
  const startedAt = '2026-11-21T10:00:00Z';
  const now = new Date('2026-11-21T10:30:00Z').getTime();

  it('subtracts pauses', () => {
    expect(elapsedSeconds({ startedAt, pausedAt: null, pausedSeconds: 300 }, now)).toBe(1500);
  });

  it('stops counting while paused', () => {
    expect(
      elapsedSeconds({ startedAt, pausedAt: '2026-11-21T10:20:00Z', pausedSeconds: 0 }, now),
    ).toBe(1200);
  });
});

describe('summarize', () => {
  it('counts ticked working sets and volume', () => {
    const items: WorkoutItem[] = [
      {
        id: 'i1',
        position: 0,
        note: null,
        device: null,
        exercise: { id: 'e1', name: 'Bankdrücken', measure: 'weight_reps' },
        sets: [
          {
            id: 's1',
            position: 0,
            weightKg: 40,
            reps: 10,
            durationSeconds: null,
            isWarmup: true,
            completedAt: 'x',
          },
          {
            id: 's2',
            position: 1,
            weightKg: 70,
            reps: 8,
            durationSeconds: null,
            isWarmup: false,
            completedAt: 'x',
          },
          {
            id: 's3',
            position: 2,
            weightKg: 72.5,
            reps: 6,
            durationSeconds: null,
            isWarmup: false,
            completedAt: null,
          },
        ],
      },
    ];
    expect(summarize(items)).toEqual({ workingSets: 1, volumeKg: 560, exercises: 1 });
  });
});
