import { useState } from 'react';
import { useUserId } from '@/features/auth';
import { cn } from '@/shared/lib';
import { useSetFinishedWorkoutFocus } from '../../api/useCalendar';
import { useAllTrainingTypes, useTrainingFocuses } from '../../api/useCatalog';
import { formatKg, formatSet, summarize } from '../../format';
import type { WorkoutDetailData, WorkoutItem } from '../../types';
import { formatDistance, formatMinutes } from '../calendar/workoutText';
import { ExerciseHistorySheet, type HistoryTarget } from '../history/ExerciseHistorySheet';
import { SaveAsTemplate } from '../templates/SaveAsTemplate';

const when = new Intl.DateTimeFormat('de', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * A finished workout: key numbers, place and focus, every exercise with its sets.
 * Read-only for now (editing comes with the feed); the focus of my own workouts can be set.
 * Also the base for the feed's workout detail later.
 */
export function WorkoutDetail({ workout }: { workout: WorkoutDetailData }) {
  const mine = workout.userId === useUserId();
  const [history, setHistory] = useState<HistoryTarget | null>(null);
  const summary = summarize(workout.items);
  const isDuration = workout.trainingType.kind === 'duration';
  const pace =
    workout.distanceM && workout.durationSeconds
      ? workout.durationSeconds / (workout.distanceM / 1000)
      : null;

  const stats: [string, string][] = isDuration
    ? [
        ['Dauer', formatMinutes(workout.durationSeconds) ?? '–'],
        ...(workout.distanceM !== null
          ? ([['Distanz', formatDistance(workout.distanceM) ?? '–']] as [string, string][])
          : []),
        ...(pace !== null
          ? ([
              [
                'Pace',
                `${String(Math.floor(pace / 60))}:${String(Math.round(pace % 60)).padStart(2, '0')} /km`,
              ],
            ] as [string, string][])
          : []),
        ...(workout.intensity !== null
          ? ([['Intensität', `${String(workout.intensity)} / 5`]] as [string, string][])
          : []),
      ]
    : [
        ['Dauer', formatMinutes(workout.durationSeconds) ?? '–'],
        ['Übungen', String(summary.exercises)],
        ['Arbeitssätze', String(summary.workingSets)],
        ['Volumen', `${formatKg(Math.round(summary.volumeKg))} kg`],
      ];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-subhead text-text-muted">
        {when.format(new Date(workout.startedAt))}
        {workout.locationName && ` · ${workout.locationName}`}
        {workout.variant && ` · ${workout.variant}`}
      </p>

      <dl className="grid grid-cols-2 gap-2">
        {stats.map(([label, value]) => (
          <div key={label} className="flex flex-col rounded-card bg-surface-2 px-4 py-3">
            <dt className="text-footnote text-text-muted">{label}</dt>
            <dd className="text-title-3 font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      {!isDuration && (mine ? <FocusPicker workout={workout} /> : <FocusText workout={workout} />)}

      {workout.note && (
        <p className="rounded-card bg-surface-2 px-4 py-3 text-subhead">{workout.note}</p>
      )}

      {workout.items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {workout.items.map((item) => (
            <ExerciseBlock
              key={item.id}
              item={item}
              onHistory={
                mine
                  ? () => {
                      setHistory({ exercise: item.exercise, device: item.device });
                    }
                  : undefined
              }
            />
          ))}
        </ul>
      )}

      {!isDuration && (
        <SaveAsTemplate
          foreign={!mine}
          workoutId={workout.id}
          trainingTypeId={workout.trainingType.id}
          focusId={workout.focus?.id ?? null}
          templateId={workout.templateId}
          exerciseIds={workout.items.map((item) => item.exercise.id)}
        />
      )}

      <ExerciseHistorySheet
        target={history}
        onClose={() => {
          setHistory(null);
        }}
      />
    </div>
  );
}

function ExerciseBlock({
  item,
  onHistory,
}: {
  item: WorkoutItem;
  onHistory?: (() => void) | undefined;
}) {
  let working = 0;
  const header = (
    <span className="flex items-baseline justify-between gap-3">
      <span className="text-subhead font-semibold">{item.exercise.name}</span>
      {item.device && item.device.name !== item.exercise.name && (
        <span className="truncate text-footnote text-text-muted">{item.device.name}</span>
      )}
    </span>
  );
  return (
    <li className="flex flex-col gap-1.5 rounded-card bg-surface-2 px-4 py-3">
      {onHistory ? (
        <button
          type="button"
          onClick={onHistory}
          className="text-left"
          aria-label={`${item.exercise.name}: Verlauf`}
        >
          {header}
        </button>
      ) : (
        header
      )}
      <ol className="flex flex-col">
        {item.sets.map((set) => (
          <li key={set.id} className="flex gap-3 text-footnote tabular-nums">
            <span
              className={cn('w-5 text-center', set.isWarmup ? 'text-warning' : 'text-text-subtle')}
            >
              {set.isWarmup ? 'W' : String(++working)}
            </span>
            <span>{formatSet(item.exercise.measure, set)}</span>
          </li>
        ))}
      </ol>
      {item.note && <p className="text-footnote text-text-muted">{item.note}</p>}
    </li>
  );
}

function FocusText({ workout }: { workout: WorkoutDetailData }) {
  if (!workout.focus) return null;
  return <p className="text-subhead text-text-muted">Fokus: {workout.focus.name}</p>;
}

/** Tap a focus to set or change it (tap the selected one again to clear). */
function FocusPicker({ workout }: { workout: WorkoutDetailData }) {
  const type = (useAllTrainingTypes().data ?? []).find((t) => t.id === workout.trainingType.id);
  const focuses = (useTrainingFocuses().data ?? []).filter(
    (focus) => !type?.focusIds || type.focusIds.includes(focus.id),
  );
  const setFocus = useSetFinishedWorkoutFocus(workout.id);
  const current = setFocus.isPending ? setFocus.variables : (workout.focus?.id ?? null);
  return (
    <div className="flex flex-col gap-2">
      <span className="text-footnote text-text-muted">Fokus</span>
      <div className="-mx-gutter no-scrollbar flex gap-2 overflow-x-auto px-gutter">
        {focuses.map((focus) => {
          const on = focus.id === current;
          return (
            <button
              key={focus.id}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setFocus.mutate(on ? null : focus.id);
              }}
              className={cn(
                'flex min-h-tap shrink-0 items-center rounded-pill border px-4 text-subhead font-semibold',
                on
                  ? 'border-accent bg-accent text-on-accent'
                  : 'border-border bg-surface-2 active:bg-surface-3',
              )}
            >
              {focus.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
