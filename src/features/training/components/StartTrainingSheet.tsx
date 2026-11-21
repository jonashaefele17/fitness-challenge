import { useState } from 'react';
import { Button, Card, SegmentedControl, Sheet, TextField } from '@/shared/ui';
import { useTrainingTypes } from '../api/useCatalog';
import { TrainingTypeForm } from './TrainingTypeForm';
import { TrainingTypeIcon } from './TrainingTypeIcon';
import { useHomeStudio, useSetHomeStudio } from '../api/usePlaces';
import { useActiveWorkout, useLogDurationEntry, useStartWorkout } from '../api/useWorkout';
import { PlacePicker } from './PlacePicker';
import type { TrainingType } from '../types';

export interface StartTrainingSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A workout with exercises is running (new or resumed) – show it. */
  onOpenWorkout: () => void;
}

type Step =
  | { kind: 'types' }
  | { kind: 'duration'; type: TrainingType }
  | { kind: 'new-type' }
  | { kind: 'home'; type: TrainingType };

const variantKey = (typeId: string) => `training-variant:${typeId}`;

function readVariant(type: TrainingType): string | undefined {
  try {
    const saved = localStorage.getItem(variantKey(type.id));
    if (saved && type.variants.includes(saved)) return saved;
  } catch {
    // Storage unavailable (private mode): fall back to the first variant.
  }
  return type.variants[0];
}

/** "+" → training type → exercises workout starts, or a quick duration entry. */
export function StartTrainingSheet({ open, onOpenChange, onOpenWorkout }: StartTrainingSheetProps) {
  const [step, setStep] = useState<Step>({ kind: 'types' });
  const types = useTrainingTypes();
  const active = useActiveWorkout();
  const start = useStartWorkout();
  const home = useHomeStudio();
  const setHome = useSetHomeStudio();

  function startWorkout(type: TrainingType) {
    start.mutate(
      { trainingTypeId: type.id },
      {
        onSuccess: () => {
          close();
          onOpenWorkout();
        },
      },
    );
  }

  function close() {
    setStep({ kind: 'types' });
    onOpenChange(false);
  }

  const title =
    step.kind === 'duration'
      ? step.type.name
      : step.kind === 'home'
        ? 'Wo ist dein Heimstudio?'
        : step.kind === 'new-type'
          ? 'Neue Trainingsart'
          : 'Training starten';

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      title={title}
    >
      {step.kind === 'duration' ? (
        <DurationEntryForm type={step.type} onDone={close} />
      ) : step.kind === 'home' ? (
        <PlacePicker
          onPick={(place) => {
            if (!place) return;
            const type = step.type;
            setHome.mutate(place.id, {
              onSuccess: () => {
                startWorkout(type);
              },
            });
          }}
        />
      ) : step.kind === 'new-type' ? (
        <TrainingTypeForm
          onDone={() => {
            setStep({ kind: 'types' });
          }}
        />
      ) : active.data ? (
        <Card elevated className="flex flex-col gap-3">
          <p className="text-subhead text-text-muted">
            Dein Training{' '}
            <span className="font-semibold text-text">{active.data.trainingType.name}</span> läuft
            noch.
          </p>
          <Button
            size="lg"
            fullWidth
            onClick={() => {
              close();
              onOpenWorkout();
            }}
          >
            Fortsetzen
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            {(types.data ?? []).map((type) => (
              <button
                key={type.id}
                type="button"
                disabled={start.isPending}
                onClick={() => {
                  if (type.kind === 'duration') {
                    setStep({ kind: 'duration', type });
                    return;
                  }
                  // First studio workout: ask once for the home studio.
                  if (type.locationMode === 'home_studio' && home.data === null) {
                    setStep({ kind: 'home', type });
                    return;
                  }
                  startWorkout(type);
                }}
                className="flex min-h-20 flex-col items-start justify-end gap-0.5 rounded-card border border-border bg-surface-2 p-4 text-left active:bg-surface-3 disabled:opacity-50"
              >
                <TrainingTypeIcon icon={type.icon} className="mb-1 size-6 text-accent" />
                <span className="text-body font-semibold">{type.name}</span>
                <span className="text-caption text-text-muted">
                  {type.kind === 'duration'
                    ? type.withDistance
                      ? 'Dauer & Distanz'
                      : 'Dauer'
                    : 'Übungen & Sätze'}
                </span>
              </button>
            ))}
          </div>
          {start.isError && (
            <p role="alert" className="text-footnote text-danger">
              Das Training konnte nicht gestartet werden.
            </p>
          )}
          <Button
            variant="ghost"
            onClick={() => {
              setStep({ kind: 'new-type' });
            }}
          >
            + Eigene Trainingsart
          </Button>
        </div>
      )}
    </Sheet>
  );
}

function DurationEntryForm({ type, onDone }: { type: TrainingType; onDone: () => void }) {
  const [minutes, setMinutes] = useState('');
  const [km, setKm] = useState('');
  const [intensity, setIntensity] = useState<string>('3');
  const [note, setNote] = useState('');
  const [variant, setVariant] = useState(() => readVariant(type));
  const log = useLogDurationEntry();
  const duration = Number(minutes.replace(',', '.'));
  const distance = Number(km.replace(',', '.'));
  const valid = Number.isFinite(duration) && duration > 0;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        log.mutate(
          {
            trainingTypeId: type.id,
            durationMinutes: duration,
            distanceKm: type.withDistance && distance > 0 ? distance : undefined,
            intensity: Number(intensity),
            note,
            variant,
          },
          {
            onSuccess: () => {
              try {
                if (variant) localStorage.setItem(variantKey(type.id), variant);
              } catch {
                // Remembering the variant is only a convenience.
              }
              onDone();
            },
          },
        );
      }}
    >
      {type.variants.length > 0 && variant && (
        <SegmentedControl
          label="Variante"
          value={variant}
          onChange={setVariant}
          options={type.variants.map((value) => ({ value, label: value }))}
        />
      )}
      <div className="flex gap-3">
        <TextField
          label="Dauer (Min.)"
          inputMode="decimal"
          value={minutes}
          onChange={(event) => {
            setMinutes(event.target.value);
          }}
        />
        {type.withDistance && (
          <TextField
            label="Distanz (km)"
            inputMode="decimal"
            value={km}
            onChange={(event) => {
              setKm(event.target.value);
            }}
          />
        )}
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-footnote font-medium text-text-muted">Intensität</span>
        <SegmentedControl
          label="Intensität"
          value={intensity}
          onChange={setIntensity}
          options={['1', '2', '3', '4', '5'].map((value) => ({ value, label: value }))}
        />
      </div>
      <TextField
        label="Notiz (optional)"
        value={note}
        maxLength={1000}
        onChange={(event) => {
          setNote(event.target.value);
        }}
      />
      {log.isError && (
        <p role="alert" className="text-footnote text-danger">
          Speichern hat nicht geklappt. Läuft vielleicht noch ein Training?
        </p>
      )}
      <Button type="submit" size="lg" fullWidth disabled={!valid} loading={log.isPending}>
        Training erledigt ✓
      </Button>
    </form>
  );
}
