import { useState } from 'react';
import { ChevronRightIcon, TextField } from '@/shared/ui';
import { useMyExercises } from '../../api/useCatalog';
import { ExerciseHistorySheet, type HistoryTarget } from '../history/ExerciseHistorySheet';
import { lastDoneText } from '../picker/historyText';
import { Sparkline } from '../Sparkline';

/** Every exercise I have done (most recent first); tap for its history. */
export function MyExercises() {
  const exercises = useMyExercises();
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState<HistoryTarget | null>(null);
  const term = query.trim().toLowerCase();
  const shown = exercises.data.filter(
    (entry) => !term || entry.exercise.name.toLowerCase().includes(term),
  );

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-title-3 font-semibold">Meine Übungen</h2>
      {exercises.data.length > 6 && (
        <TextField
          label="Übung suchen"
          value={query}
          autoCorrect="off"
          onChange={(event) => {
            setQuery(event.target.value);
          }}
        />
      )}
      {!exercises.isPending && exercises.data.length === 0 && (
        <p className="text-footnote text-text-subtle">
          Sobald du Trainings abgeschlossen hast, siehst du hier jede Übung mit ihrem Verlauf.
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {shown.map(({ exercise, history }) => (
          <li key={exercise.id}>
            <button
              type="button"
              onClick={() => {
                setTarget({ exercise, device: null });
              }}
              className="flex min-h-tap w-full items-center gap-3 rounded-card bg-surface-2 px-4 py-3 text-left active:bg-surface-3"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-subhead font-semibold">{exercise.name}</span>
                <span className="truncate text-footnote text-text-muted">
                  {lastDoneText(history, exercise)}
                </span>
              </span>
              <Sparkline points={history.trend} />
              <ChevronRightIcon aria-hidden className="shrink-0 text-text-subtle" />
            </button>
          </li>
        ))}
      </ul>
      <ExerciseHistorySheet
        target={target}
        onClose={() => {
          setTarget(null);
        }}
      />
    </section>
  );
}
