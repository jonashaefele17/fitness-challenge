import { useState } from 'react';
import { cn } from '@/shared/lib';
import { Button, SegmentedControl, TextField } from '@/shared/ui';
import { useCreatePlace, useHomeStudio, usePlaces } from '../api/usePlaces';
import type { Place } from '../types';

export interface PlacePickerProps {
  /** Currently selected place (highlighted). */
  currentId?: string | null | undefined;
  /** Offer "unterwegs" (no place). */
  allowNone?: boolean;
  onPick: (place: Place | null) => void;
}

/** Search studios and own places, or add a new one. */
export function PlacePicker({ currentId, allowNone = false, onPick }: PlacePickerProps) {
  const places = usePlaces();
  const home = useHomeStudio().data ?? null;
  const create = useCreatePlace();
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<'public' | 'private'>('public');

  const term = query.trim().toLowerCase();
  const list = (places.data ?? []).filter((place) => place.name.toLowerCase().includes(term));
  const exists = (places.data ?? []).some((place) => place.name.toLowerCase() === term);

  if (adding) {
    return (
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate({ name: query, isPrivate: kind === 'private' }, { onSuccess: onPick });
        }}
      >
        <TextField
          label="Name"
          placeholder="z. B. FitX Karlsruhe Innenstadt"
          value={query}
          maxLength={60}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          error={create.isError ? 'Diesen Ort gibt es schon – such ihn in der Liste.' : null}
        />
        <SegmentedControl
          label="Art des Orts"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'public', label: 'Studio (für alle)' },
            { value: 'private', label: 'Privat (nur ich)' },
          ]}
        />
        <div className="flex gap-2">
          <Button type="submit" disabled={query.trim().length < 2} loading={create.isPending}>
            Anlegen
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setAdding(false);
            }}
          >
            Zurück
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <TextField
        label="Studio suchen"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
        }}
      />
      <ul className="-mx-gutter flex flex-col">
        {allowNone && (
          <li>
            <PlaceRow
              label="Unterwegs (ohne Ort)"
              selected={currentId === null}
              onClick={() => {
                onPick(null);
              }}
            />
          </li>
        )}
        {list.map((place) => (
          <li key={place.id}>
            <PlaceRow
              label={place.name}
              hint={place.id === home ? 'Heimstudio' : place.private ? 'Privat' : undefined}
              selected={place.id === currentId}
              onClick={() => {
                onPick(place);
              }}
            />
          </li>
        ))}
      </ul>
      {!exists && (
        <Button
          variant="secondary"
          onClick={() => {
            setAdding(true);
          }}
        >
          {term ? `„${query.trim()}“ anlegen` : 'Neuen Ort anlegen'}
        </Button>
      )}
    </div>
  );
}

function PlaceRow({
  label,
  hint,
  selected,
  onClick,
}: {
  label: string;
  hint?: string | undefined;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-tap w-full items-center justify-between gap-3 px-gutter py-2.5 text-left active:bg-surface-2',
        selected && 'text-accent',
      )}
    >
      <span className="text-body">{label}</span>
      <span className="text-footnote text-text-subtle">{selected ? '✓' : hint}</span>
    </button>
  );
}
