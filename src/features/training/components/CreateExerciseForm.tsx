import { useState } from 'react';
import { cn } from '@/shared/lib';
import { Button, Chip, SegmentedControl, TextField } from '@/shared/ui';
import { useCreateExercise, useMuscleGroups } from '../api/useCatalog';
import { measures } from '../measures';
import type { ExerciseMeasure, ExerciseSummary } from '../types';

/** New exercise: name, measure and optional muscle groups. */
export function CreateExerciseForm({
  initialName,
  onCancel,
  onCreated,
}: {
  initialName: string;
  onCancel: () => void;
  onCreated: (exercise: ExerciseSummary) => void;
}) {
  const [name, setName] = useState(initialName.trim());
  const [measure, setMeasure] = useState<ExerciseMeasure>('weight_reps');
  const [primary, setPrimary] = useState<string[]>([]);
  const [secondary, setSecondary] = useState<string[]>([]);
  const muscles = useMuscleGroups();
  const create = useCreateExercise();
  const duplicate =
    create.error && 'code' in create.error && create.error.code === '23505'
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
        create.mutate(
          { name, measure, primaryMuscles: primary, secondaryMuscles: secondary },
          { onSuccess: onCreated },
        );
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
      <div className="flex flex-col gap-2">
        <span className="text-footnote font-medium text-text-muted">Erfassung</span>
        <SegmentedControl
          label="Erfassung"
          value={measure}
          options={measures}
          onChange={setMeasure}
        />
      </div>
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
      <div className="flex gap-2">
        <Button type="submit" disabled={name.trim().length < 2} loading={create.isPending}>
          Anlegen
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Zurück
        </Button>
      </div>
    </form>
  );
}
