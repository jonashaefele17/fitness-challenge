import { useState } from 'react';
import { cn } from '@/shared/lib';
import { Button, TextField } from '@/shared/ui';
import { useCreateTrainingFocus, useMuscleGroups, useTrainingFocuses } from '../../api/useCatalog';

const chip =
  'flex min-h-tap shrink-0 items-center rounded-pill border px-4 text-subhead font-semibold';

/** "Alle · Push · Pull · Beine … · + Eigener": filters the picker by primary muscles. */
export function FocusChips({
  focusId,
  onChange,
  onCreate,
}: {
  focusId: string | null;
  onChange: (focusId: string | null) => void;
  onCreate: () => void;
}) {
  const focuses = useTrainingFocuses().data ?? [];
  const options = [{ id: null, name: 'Alle' }, ...focuses];
  return (
    <div
      role="radiogroup"
      aria-label="Trainingsfokus"
      className="-mx-gutter no-scrollbar flex gap-2 overflow-x-auto px-gutter"
    >
      {options.map((focus) => {
        const selected = focus.id === focusId;
        return (
          <button
            key={focus.id ?? 'all'}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => {
              onChange(focus.id);
            }}
            className={cn(
              chip,
              selected
                ? 'border-accent bg-accent text-on-accent'
                : 'border-border bg-surface-2 text-text active:bg-surface-3',
            )}
          >
            {focus.name}
          </button>
        );
      })}
      <button
        type="button"
        onClick={onCreate}
        className={cn(chip, 'border-dashed border-border text-accent active:bg-surface-2')}
      >
        + Eigener
      </button>
    </div>
  );
}

/** A personal focus: a name plus the muscle groups it covers. */
export function NewFocusForm({ onCreated }: { onCreated: (focusId: string) => void }) {
  const muscles = useMuscleGroups().data ?? [];
  const create = useCreateTrainingFocus();
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate({ name, shortName, muscleGroups: selected }, { onSuccess: onCreated });
      }}
    >
      <TextField
        label="Name"
        placeholder="z. B. Brust & Bizeps"
        value={name}
        maxLength={40}
        onChange={(event) => {
          setName(event.target.value);
        }}
      />
      <TextField
        label="Kürzel im Kalender"
        placeholder="z. B. BrBi"
        hint="Bis zu 5 Zeichen. Leer: die ersten 5 Buchstaben des Namens."
        value={shortName}
        maxLength={5}
        onChange={(event) => {
          setShortName(event.target.value);
        }}
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-subhead text-text-muted">Muskelgruppen</legend>
        <div className="flex flex-wrap gap-2">
          {muscles.map((muscle) => {
            const on = selected.includes(muscle.key);
            return (
              <button
                key={muscle.key}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setSelected((list) =>
                    on ? list.filter((key) => key !== muscle.key) : [...list, muscle.key],
                  );
                }}
                className={cn(
                  chip,
                  on
                    ? 'border-accent bg-accent text-on-accent'
                    : 'border-border bg-surface-2 active:bg-surface-3',
                )}
              >
                {muscle.label}
              </button>
            );
          })}
        </div>
      </fieldset>
      {create.isError && (
        <p role="alert" className="text-footnote text-danger">
          Speichern hat nicht geklappt.
        </p>
      )}
      <Button
        type="submit"
        disabled={name.trim().length < 2 || selected.length === 0}
        loading={create.isPending}
      >
        Fokus anlegen
      </Button>
    </form>
  );
}
