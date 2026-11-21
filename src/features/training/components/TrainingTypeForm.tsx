import { useState } from 'react';
import { cn } from '@/shared/lib';
import { Button, SegmentedControl, Switch, TextField } from '@/shared/ui';
import { useCreateTrainingType, useUpdateTrainingType } from '../api/useCatalog';
import { trainingIconKeys } from '../trainingIcons';
import type { TrainingType } from '../types';
import { TrainingTypeIcon } from './TrainingTypeIcon';

/**
 * A personal training type: name, how it is logged, and its calendar icon. With `initial`
 * it edits one of mine (how it is logged stays as created: past workouts depend on it).
 */
export function TrainingTypeForm({
  initial,
  onDone,
}: {
  initial?: TrainingType | undefined;
  onDone: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [kind, setKind] = useState<TrainingType['kind']>(initial?.kind ?? 'duration');
  const [withDistance, setWithDistance] = useState(initial?.withDistance ?? false);
  const [icon, setIcon] = useState<string>(initial?.icon ?? 'generic');
  const create = useCreateTrainingType();
  const update = useUpdateTrainingType();
  const pending = create.isPending || update.isPending;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (initial) {
          update.mutate({ id: initial.id, name, withDistance, icon }, { onSuccess: onDone });
        } else {
          create.mutate({ name, kind, withDistance, icon }, { onSuccess: onDone });
        }
      }}
    >
      <TextField
        label="Name"
        placeholder="z. B. Klettern, Schwimmen, Yoga"
        value={name}
        maxLength={40}
        onChange={(event) => {
          setName(event.target.value);
        }}
      />
      {!initial && (
        <SegmentedControl
          label="Erfassung"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'duration', label: 'Nur Dauer' },
            { value: 'exercises', label: 'Übungen & Sätze' },
          ]}
        />
      )}
      {kind === 'duration' && (
        <Switch label="Mit Distanz" checked={withDistance} onCheckedChange={setWithDistance} />
      )}
      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="mb-2 text-subhead text-text-muted">Symbol im Kalender</legend>
        <div className="grid grid-cols-4 gap-2">
          {trainingIconKeys.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={icon === key}
              aria-label={key}
              onClick={() => {
                setIcon(key);
              }}
              className={cn(
                'flex min-h-tap items-center justify-center rounded-card border py-2',
                icon === key
                  ? 'border-accent text-accent'
                  : 'border-border text-text-muted active:bg-surface-2',
              )}
            >
              <TrainingTypeIcon icon={key} className="size-6" />
            </button>
          ))}
        </div>
      </fieldset>
      <Button
        type="submit"
        missing={name.trim().length < 2 ? 'Gib der Trainingsart einen Namen.' : null}
        loading={pending}
      >
        {initial ? 'Speichern' : 'Anlegen'}
      </Button>
    </form>
  );
}
