import { useState } from 'react';
import { cn } from '@/shared/lib';
import { Button, SegmentedControl, Switch, TextField } from '@/shared/ui';
import { useCreateTrainingType } from '../api/useCatalog';
import { trainingIconKeys } from '../trainingIcons';
import type { TrainingType } from '../types';
import { TrainingTypeIcon } from './TrainingTypeIcon';

/** A personal training type: name, how it is logged, and its calendar icon. */
export function TrainingTypeForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<TrainingType['kind']>('duration');
  const [withDistance, setWithDistance] = useState(false);
  const [icon, setIcon] = useState<string>('generic');
  const create = useCreateTrainingType();

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate({ name, kind, withDistance, icon }, { onSuccess: onDone });
      }}
    >
      <TextField
        label="Name"
        placeholder="z. B. Mobility, Klettern, Radfahren"
        value={name}
        maxLength={40}
        onChange={(event) => {
          setName(event.target.value);
        }}
      />
      <SegmentedControl
        label="Erfassung"
        value={kind}
        onChange={setKind}
        options={[
          { value: 'duration', label: 'Nur Dauer' },
          { value: 'exercises', label: 'Übungen & Sätze' },
        ]}
      />
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
      <Button type="submit" disabled={name.trim().length < 2} loading={create.isPending}>
        Anlegen
      </Button>
    </form>
  );
}
