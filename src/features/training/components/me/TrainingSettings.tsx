import { useState } from 'react';
import { Button, ChevronRightIcon, Sheet, Switch } from '@/shared/ui';
import {
  useAllTrainingTypes,
  useHiddenTrainingTypes,
  useSetTrainingTypeHidden,
  useUpdateTrainingType,
} from '../../api/useCatalog';
import { useHomeStudio, usePlaces, useSetHomeStudio } from '../../api/usePlaces';
import type { TrainingType } from '../../types';
import { PlacePicker } from '../PlacePicker';
import { TrainingTypeForm } from '../TrainingTypeForm';
import { TrainingTypeIcon } from '../TrainingTypeIcon';

type Editing = { kind: 'home' } | { kind: 'new-type' } | { kind: 'type'; type: TrainingType };

/**
 * Training settings under "Ich": home studio, and which training types I use. The default
 * types are a catalogue: switch off what you never do; own types can be edited or archived.
 */
export function TrainingSettings() {
  const homeId = useHomeStudio().data ?? null;
  const home = (usePlaces().data ?? []).find((place) => place.id === homeId);
  const setHome = useSetHomeStudio();
  const types = useAllTrainingTypes().data ?? [];
  const hidden = useHiddenTrainingTypes().data ?? [];
  const setHidden = useSetTrainingTypeHidden();
  const update = useUpdateTrainingType();
  const [editing, setEditing] = useState<Editing | null>(null);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-title-3 font-semibold">Training</h2>
      <div className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
        <button
          type="button"
          onClick={() => {
            setEditing({ kind: 'home' });
          }}
          className="flex min-h-tap items-center justify-between gap-3 px-4 py-3 text-left active:bg-surface-3"
        >
          <span className="flex flex-col">
            <span className="text-body">Heimstudio</span>
            <span className="text-footnote text-text-muted">
              {home?.name ?? 'Noch nicht gewählt'}
            </span>
          </span>
          <ChevronRightIcon aria-hidden className="shrink-0 text-text-subtle" />
        </button>
      </div>

      <h3 className="pt-2 text-subhead font-semibold">Meine Trainingsarten</h3>
      <p className="-mt-2 text-footnote text-text-muted">
        Was du ausschaltest, taucht beim Start und in Vorlagen nicht mehr auf.
      </p>
      <ul className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
        {types.map((type) => (
          <li key={type.id} className="flex items-center gap-3 px-4">
            <TrainingTypeIcon icon={type.icon} className="size-5 shrink-0 text-text-muted" />
            <div className="min-w-0 flex-1">
              <Switch
                label={type.name}
                {...(type.ownerId ? { description: 'Eigene Trainingsart' } : {})}
                checked={!hidden.includes(type.id)}
                onCheckedChange={(on) => {
                  setHidden.mutate({ id: type.id, hidden: !on });
                }}
              />
            </div>
            {type.ownerId && (
              <button
                type="button"
                aria-label={`${type.name} bearbeiten`}
                onClick={() => {
                  setEditing({ kind: 'type', type });
                }}
                className="flex size-tap shrink-0 items-center justify-center rounded-pill text-text-subtle active:bg-surface-3"
              >
                <ChevronRightIcon aria-hidden />
              </button>
            )}
          </li>
        ))}
      </ul>
      <Button
        variant="secondary"
        onClick={() => {
          setEditing({ kind: 'new-type' });
        }}
      >
        + Eigene Trainingsart
      </Button>

      <Sheet
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        title={
          editing?.kind === 'home'
            ? 'Heimstudio'
            : editing?.kind === 'type'
              ? editing.type.name
              : 'Neue Trainingsart'
        }
        // The place list keeps a steady height; the short forms fit their content.
        {...(editing?.kind === 'home' ? { className: 'min-h-sheet-min' } : {})}
      >
        {editing?.kind === 'home' && (
          <PlacePicker
            currentId={homeId}
            onPick={(place) => {
              if (place) setHome.mutate(place.id);
              setEditing(null);
            }}
          />
        )}
        {editing?.kind === 'new-type' && (
          <TrainingTypeForm
            onDone={() => {
              setEditing(null);
            }}
          />
        )}
        {editing?.kind === 'type' && (
          <div className="flex flex-col gap-4">
            <TrainingTypeForm
              initial={editing.type}
              onDone={() => {
                setEditing(null);
              }}
            />
            <Button
              variant="ghost"
              onClick={() => {
                update.mutate({ id: editing.type.id, archived: true });
                setEditing(null);
              }}
            >
              Archivieren
            </Button>
          </div>
        )}
      </Sheet>
    </section>
  );
}
