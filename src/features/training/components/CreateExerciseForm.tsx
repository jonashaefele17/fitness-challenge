import { useState } from 'react';
import { cn } from '@/shared/lib';
import { Button, Chip, SegmentedControl, TextField } from '@/shared/ui';
import {
  useCreateExercise,
  useMuscleGroups,
  useUpdateExercise,
  type ExerciseDetails,
} from '../api/useCatalog';
import { measures } from '../measures';
import type { ExerciseCatalog, ExerciseMeasure, ExerciseSummary } from '../types';

/**
 * New exercise (name, measure, optional muscle groups and how-to), or with `initial` an
 * existing one to edit (the measure stays: past sets depend on it). The illustration /
 * animation of an exercise will be added here with the image upload.
 */
export function CreateExerciseForm({
  initialName = '',
  initial,
  catalog = 'strength',
  onCancel,
  onCreated,
}: {
  initialName?: string;
  initial?: ExerciseDetails | undefined;
  /** Catalogue the exercise goes into (mobility: holds/flows, timed by default). */
  catalog?: ExerciseCatalog;
  onCancel: () => void;
  onCreated: (exercise: ExerciseSummary) => void;
}) {
  const [name, setName] = useState(initial?.name ?? initialName.trim());
  const [measure, setMeasure] = useState<ExerciseMeasure>(
    initial?.measure ?? (catalog === 'mobility' ? 'duration' : 'weight_reps'),
  );
  const [instructions, setInstructions] = useState(initial?.instructions ?? '');
  const [primary, setPrimary] = useState<string[]>(initial?.primaryMuscles ?? []);
  const [secondary, setSecondary] = useState<string[]>(initial?.secondaryMuscles ?? []);
  const muscles = useMuscleGroups();
  const create = useCreateExercise();
  const update = useUpdateExercise();
  const error = create.error ?? update.error;
  const duplicate =
    error && 'code' in error && error.code === '23505'
      ? 'Diese Übung gibt es schon – such sie in der Liste.'
      : null;

  // Tap cycles a muscle: off → main → involved → off.
  function cycle(key: string) {
    if (primary.includes(key)) {
      setPrimary(primary.filter((k) => k !== key));
      setSecondary([...secondary, key]);
    } else if (secondary.includes(key)) {
      setSecondary(secondary.filter((k) => k !== key));
    } else {
      setPrimary([...primary, key]);
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (initial) {
          update.mutate(
            {
              id: initial.id,
              name,
              instructions,
              primaryMuscles: primary,
              secondaryMuscles: secondary,
            },
            {
              onSuccess: () => {
                onCreated({ id: initial.id, name: name.trim(), measure: initial.measure });
              },
            },
          );
        } else {
          create.mutate(
            {
              name,
              measure,
              instructions,
              primaryMuscles: primary,
              secondaryMuscles: secondary,
              catalog,
            },
            { onSuccess: onCreated },
          );
        }
      }}
    >
      <TextField
        label="Name"
        value={name}
        maxLength={60}
        onChange={(event) => {
          setName(event.target.value);
        }}
        error={duplicate}
      />
      {!initial && catalog === 'strength' && (
        <div className="flex flex-col gap-2">
          <span className="text-footnote font-medium text-text-muted">Erfassung</span>
          <SegmentedControl
            label="Erfassung"
            value={measure}
            options={measures}
            onChange={setMeasure}
          />
        </div>
      )}
      <label className="flex flex-col gap-1.5">
        <span className="text-footnote font-medium text-text-muted">Ausführung (optional)</span>
        <textarea
          value={instructions}
          maxLength={500}
          rows={3}
          placeholder="z. B. Knie über dem Fuß, Rücken lang, ruhig atmen"
          onChange={(event) => {
            setInstructions(event.target.value);
          }}
          className="resize-none rounded-md border border-border bg-surface-2 px-4 py-3 text-body text-text placeholder:text-text-subtle focus:border-accent focus:outline-none"
        />
      </label>
      <div className="flex flex-col gap-2">
        <span className="text-footnote font-medium text-text-muted">
          Muskelgruppen (optional) – 1× tippen: Haupt, 2×: mitbeteiligt
        </span>
        <div className="flex flex-wrap gap-2">
          {(muscles.data ?? []).map((muscle) => (
            <Chip
              key={muscle.key}
              selected={primary.includes(muscle.key)}
              className={cn(secondary.includes(muscle.key) && 'border-accent text-accent')}
              onClick={() => {
                cycle(muscle.key);
              }}
            >
              {muscle.label}
            </Chip>
          ))}
        </div>
      </div>
      {update.error && !duplicate && (
        <p role="alert" className="text-footnote text-danger">
          Speichern hat nicht geklappt. Bearbeiten darf nur, wer die Übung angelegt hat.
        </p>
      )}
      <div className="flex gap-2">
        <Button
          type="submit"
          missing={name.trim().length < 2 ? 'Gib der Übung einen Namen.' : null}
          loading={create.isPending || update.isPending}
        >
          {initial ? 'Speichern' : 'Anlegen'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Zurück
        </Button>
      </div>
    </form>
  );
}
