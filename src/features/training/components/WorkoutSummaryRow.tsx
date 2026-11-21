import { ChevronRightIcon } from '@/shared/ui';
import type { WorkoutCardSummary } from '../types';
import { formatDistance, formatMinutes } from './calendar/workoutText';
import { TrainingTypeIcon } from './TrainingTypeIcon';

const MAX_NAMES = 3;
const volume = new Intl.NumberFormat('de', { maximumFractionDigits: 0 });

/**
 * One finished workout in a card (e.g. the feed): type and focus, the key numbers, the
 * exercises and new best sets. Tapping opens the workout.
 */
export function WorkoutSummaryRow({
  workout,
  color,
  onOpen,
}: {
  workout: WorkoutCardSummary;
  /** Colour of the icon (the person's colour). */
  color: string;
  onOpen: () => void;
}) {
  const strength = workout.trainingType.kind === 'exercises';
  const title = [workout.trainingType.name, workout.focusName ?? workout.variant]
    .filter(Boolean)
    .join(' · ');
  const numbers = strength
    ? [
        formatMinutes(workout.durationSeconds),
        workout.trainingType.guided || workout.workingSets === 0
          ? null
          : `${String(workout.workingSets)} ${workout.workingSets === 1 ? 'Satz' : 'Sätze'}`,
        workout.volumeKg > 0 ? `${volume.format(workout.volumeKg)} kg` : null,
      ]
    : [formatDistance(workout.distanceM), formatMinutes(workout.durationSeconds)];
  const names = workout.exerciseNames.slice(0, MAX_NAMES).join(', ');
  const more = workout.exerciseNames.length - MAX_NAMES;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-tap w-full items-start gap-3 rounded-card bg-surface-2 px-4 py-3 text-left active:bg-surface-3"
    >
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-surface-3"
        style={{ color }}
      >
        <TrainingTypeIcon icon={workout.trainingType.icon} variant="filled" className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-subhead font-semibold">{title}</span>
        <span className="truncate text-footnote text-text-muted">
          {numbers.filter(Boolean).join(' · ')}
        </span>
        {strength && names && (
          <span className="line-clamp-2 text-footnote text-text-subtle">
            {names}
            {more > 0 ? ` +${String(more)}` : ''}
          </span>
        )}
        {workout.recordCount > 0 && (
          <span className="text-footnote font-semibold text-accent">
            🏆{' '}
            {workout.recordCount === 1 ? '1 Bestwert' : `${String(workout.recordCount)} Bestwerte`}
          </span>
        )}
      </span>
      <ChevronRightIcon aria-hidden className="mt-2 shrink-0 text-text-subtle" />
    </button>
  );
}
