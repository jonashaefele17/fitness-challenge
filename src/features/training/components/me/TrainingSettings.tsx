import { useState } from 'react';
import { Button, ChevronRightIcon, Sheet } from '@/shared/ui';
import { useTrainingTypes } from '../../api/useCatalog';
import { useHomeStudio, usePlaces, useSetHomeStudio } from '../../api/usePlaces';
import { PlacePicker } from '../PlacePicker';
import { TrainingTypeForm } from '../TrainingTypeForm';
import { TrainingTypeIcon } from '../TrainingTypeIcon';

/** Training settings under "Ich": home studio and training types. */
export function TrainingSettings() {
  const homeId = useHomeStudio().data ?? null;
  const home = (usePlaces().data ?? []).find((place) => place.id === homeId);
  const setHome = useSetHomeStudio();
  const types = useTrainingTypes().data ?? [];
  const [sheet, setSheet] = useState<'home' | 'type' | null>(null);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-title-3 font-semibold">Training</h2>
      <div className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
        <button
          type="button"
          onClick={() => {
            setSheet('home');
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
        <div className="flex flex-col gap-2 px-4 py-3">
          <span className="text-body">Trainingsarten</span>
          <ul className="flex flex-wrap gap-2">
            {types.map((type) => (
              <li
                key={type.id}
                className="flex min-h-tap items-center gap-2 rounded-pill bg-surface-3 px-3 text-subhead"
              >
                <TrainingTypeIcon icon={type.icon} className="size-4 text-text-muted" />
                {type.name}
              </li>
            ))}
          </ul>
          <Button
            variant="secondary"
            onClick={() => {
              setSheet('type');
            }}
          >
            + Eigene Trainingsart
          </Button>
        </div>
      </div>

      <Sheet
        open={sheet !== null}
        onOpenChange={(open) => {
          if (!open) setSheet(null);
        }}
        title={sheet === 'home' ? 'Heimstudio' : 'Neue Trainingsart'}
        className="min-h-sheet-min"
      >
        {sheet === 'home' && (
          <PlacePicker
            currentId={homeId}
            onPick={(place) => {
              if (place) setHome.mutate(place.id);
              setSheet(null);
            }}
          />
        )}
        {sheet === 'type' && (
          <TrainingTypeForm
            onDone={() => {
              setSheet(null);
            }}
          />
        )}
      </Sheet>
    </section>
  );
}
