import type { ExerciseMeasure } from './types';

export const measures: { value: ExerciseMeasure; label: string }[] = [
  { value: 'weight_reps', label: 'Gewicht × Wdh.' },
  { value: 'reps', label: 'Wiederholungen' },
  { value: 'duration', label: 'Dauer' },
];

export const measureLabel: Record<ExerciseMeasure, string> = {
  weight_reps: 'Gewicht × Wdh.',
  reps: 'Wiederholungen',
  duration: 'Dauer',
};
