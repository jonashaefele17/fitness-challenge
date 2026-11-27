import { describe, expect, it } from 'vitest';
import {
  formatBestSet,
  formatGoalNumber,
  formatGoalTarget,
  formatGoalValue,
  formatProgress,
  goalPointStateText,
  goalStatusText,
  goalTitle,
  onTrackText,
  progressBarPct,
  rateSummaryText,
  thisWeekText,
} from './format';

describe('goal values', () => {
  it('formats each unit in German', () => {
    expect(formatGoalValue(82.5, 'kg')).toBe('82,5 kg');
    expect(formatGoalValue(88, 'cm')).toBe('88,0 cm');
    expect(formatGoalValue(12, 'reps')).toBe('12 Wdh.');
    expect(formatGoalValue(45, 'seconds')).toBe('45 s');
    expect(formatGoalValue(90, 'seconds')).toBe('1:30 min');
    expect(formatGoalValue(77.8, 'percent')).toBe('78 %');
    expect(formatGoalValue(3, 'per_week')).toBe('3 pro Woche');
    expect(formatGoalValue(3.5, 'per_week')).toBe('3,5 pro Woche');
    expect(formatGoalValue(null, 'kg')).toBe('–');
  });

  it('formats numbers without the unit', () => {
    expect(formatGoalNumber(82.5, 'kg')).toBe('82,5');
    expect(formatGoalNumber(4, 'per_week')).toBe('4');
    expect(formatGoalNumber(90, 'percent')).toBe('90');
    expect(formatGoalNumber(null, 'cm')).toBe('–');
  });

  it('says the rep count of a weight exercise', () => {
    expect(formatGoalTarget(110, { unit: 'kg', reps: 5 })).toBe('110,0 kg bei 5 Wdh.');
    expect(formatGoalTarget(80, { unit: 'kg', reps: null })).toBe('80,0 kg');
    expect(formatGoalTarget(null, { unit: 'kg', reps: 5 })).toBe('–');
  });

  it('formats the best set', () => {
    expect(formatBestSet({ weightKg: 102.5, reps: 5, durationSeconds: null })).toBe('102,5 kg × 5');
    expect(formatBestSet({ weightKg: null, reps: 15, durationSeconds: null })).toBe('15 Wdh.');
    expect(formatBestSet({ weightKg: null, reps: null, durationSeconds: 75 })).toBe('1:15 min');
    expect(formatBestSet(null)).toBe('–');
  });
});

describe('progress and status', () => {
  it('rounds progress to whole percent', () => {
    expect(formatProgress(85.7)).toBe('86 %');
    expect(formatProgress(-10)).toBe('-10 %');
    expect(formatProgress(null)).toBe('–');
  });

  it('clamps the bar', () => {
    expect(progressBarPct(50)).toBe(50);
    expect(progressBarPct(-10)).toBe(0);
    expect(progressBarPct(130)).toBe(100);
    expect(progressBarPct(null)).toBe(0);
  });

  it('names statuses and week states', () => {
    expect(goalStatusText('target_reached')).toBe('Ziel erreicht');
    expect(goalStatusText('min_reached')).toBe('Mindestziel erreicht');
    expect(goalStatusText('below_min')).toBe('Unter dem Mindestziel');
    expect(goalStatusText('not_reached')).toBe('Noch nicht erreicht');
    expect(goalStatusText(null)).toBe('Noch keine Werte');
    expect(goalPointStateText('open')).toBe('Läuft noch');
    expect(goalPointStateText('paused')).toBe('Pause');
    expect(goalPointStateText('min_reached')).toBe('Mindestziel erreicht');
  });

  it('says on course or behind', () => {
    expect(onTrackText(true)).toBe('Auf Kurs');
    expect(onTrackText(false)).toBe('Hinter Plan');
    expect(onTrackText(null)).toBeNull();
  });
});

describe('texts', () => {
  it('names the goal after its reference', () => {
    expect(
      goalTitle({ referenceLabel: 'Bankdrücken', metricLabel: 'Bestwert an einer Übung' }),
    ).toBe('Bankdrücken');
    expect(goalTitle({ referenceLabel: null, metricLabel: 'Körpergewicht' })).toBe('Körpergewicht');
  });

  const trainings = {
    metric: 'trainings_per_week',
    metricKind: 'rate' as const,
    countUnit: 'weeks' as const,
  };

  it('sums up trainings weeks', () => {
    expect(rateSummaryText({ ...trainings, counted: 3, minMet: 2, targetMet: 1 })).toBe(
      'In 2 von 3 Wochen Mindestziel, in 1 Ziel erreicht',
    );
    expect(rateSummaryText({ ...trainings, counted: 1, minMet: null, targetMet: 1 })).toBe(
      'In 1 von 1 Woche Ziel erreicht',
    );
    expect(rateSummaryText({ ...trainings, counted: 0, minMet: null, targetMet: 0 })).toBe(
      'Noch keine abgeschlossene Woche',
    );
  });

  it('sums up habit days and weeks', () => {
    const habit = { metric: 'habit_rate', metricKind: 'rate' as const, minMet: null };
    expect(rateSummaryText({ ...habit, countUnit: 'days', counted: 9, targetMet: 7 })).toBe(
      'An 7 von 9 Tagen geschafft',
    );
    expect(rateSummaryText({ ...habit, countUnit: 'weeks', counted: 4, targetMet: 3 })).toBe(
      'In 3 von 4 Wochen geschafft',
    );
    expect(rateSummaryText({ ...habit, countUnit: 'days', counted: 0, targetMet: 0 })).toBe(
      'Noch nichts gezählt',
    );
  });

  it('has no rate summary for levels', () => {
    expect(
      rateSummaryText({
        metric: 'body_weight',
        metricKind: 'level',
        counted: null,
        minMet: null,
        targetMet: null,
        countUnit: null,
      }),
    ).toBeNull();
  });

  it('shows the running week', () => {
    expect(thisWeekText({ thisWeek: { done: 1, min: 3, target: 4 } })).toBe('Diese Woche 1 von 4');
    expect(thisWeekText({ thisWeek: null })).toBeNull();
  });
});
