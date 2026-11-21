import { useState } from 'react';
import { cn } from '@/shared/lib';
import { Button, Sheet, Switch, TextField } from '@/shared/ui';
import { linkExerciseToDevice, useCreateDevice, useDevicesAt } from '../api/usePlaces';
import { useSetItemDevice } from '../api/useWorkout';
import type { Device, Place, WorkoutItem } from '../types';

export interface DevicePickerSheetProps {
  item: WorkoutItem | null;
  place: Place | null;
  onClose: () => void;
}

/** Pick the device used for an exercise here, or add it as a new device. */
export function DevicePickerSheet({ item, place, onClose }: DevicePickerSheetProps) {
  return (
    <Sheet
      open={item !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Welches Gerät?"
      className="min-h-sheet-min"
    >
      {item &&
        (place ? (
          <Picker key={item.id} item={item} place={place} onDone={onClose} />
        ) : (
          <p className="text-subhead text-text-muted">
            Für Geräte braucht das Training einen Ort. Wähl ihn über „…“ → „Ort ändern“.
          </p>
        ))}
    </Sheet>
  );
}

function Picker({ item, place, onDone }: { item: WorkoutItem; place: Place; onDone: () => void }) {
  const devices = useDevicesAt(place.id).data ?? [];
  const setDevice = useSetItemDevice();
  const create = useCreateDevice();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState(item.exercise.name);
  const [step, setStep] = useState('2,5');
  const [comparable, setComparable] = useState(false);

  // Devices that already offer this exercise come first.
  const sorted = [...devices].sort(
    (a, b) =>
      Number(b.exercises.some((e) => e.id === item.exercise.id)) -
      Number(a.exercises.some((e) => e.id === item.exercise.id)),
  );

  function choose(device: Device | null) {
    setDevice.mutate({ itemId: item.id, device });
    if (device) void linkExerciseToDevice(device.id, item.exercise.id);
    onDone();
  }

  if (adding) {
    const stepValue = step.trim() === '' ? null : Number(step.replace(',', '.'));
    return (
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate(
            {
              locationId: place.id,
              name,
              weightStep: stepValue,
              comparable,
              exerciseId: item.exercise.id,
            },
            { onSuccess: choose },
          );
        }}
      >
        <p className="text-subhead text-text-muted">Neues Gerät in {place.name}</p>
        <TextField
          label="Name des Geräts"
          value={name}
          maxLength={60}
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
        <TextField
          label="Gewichtsstufe (kg)"
          inputMode="decimal"
          value={step}
          onChange={(event) => {
            setStep(event.target.value);
          }}
        />
        <Switch
          label="Überall vergleichbar"
          description="Kurzhanteln, Bank, Stange: an. Maschinen: aus."
          checked={comparable}
          onCheckedChange={setComparable}
        />
        <div className="flex gap-2">
          <Button type="submit" disabled={name.trim().length < 2} loading={create.isPending}>
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
      <div className="grid grid-cols-2 gap-2">
        {sorted.map((device) => {
          const offers = device.exercises.some((e) => e.id === item.exercise.id);
          const selected = item.device?.id === device.id;
          return (
            <button
              key={device.id}
              type="button"
              onClick={() => {
                choose(device);
              }}
              className={cn(
                'flex min-h-20 flex-col items-start justify-end gap-0.5 rounded-card border bg-surface-2 p-3 text-left active:bg-surface-3',
                selected ? 'border-accent' : 'border-border',
              )}
            >
              <span className="text-subhead font-semibold">{device.name}</span>
              <span className="text-caption text-text-muted">
                {offers ? 'passt zur Übung' : `${String(device.exercises.length)} Übungen`}
              </span>
            </button>
          );
        })}
      </div>
      <Button
        variant="secondary"
        onClick={() => {
          setAdding(true);
        }}
      >
        + Neues Gerät hier
      </Button>
      {item.device && (
        <Button
          variant="ghost"
          onClick={() => {
            choose(null);
          }}
        >
          Ohne Gerät
        </Button>
      )}
    </div>
  );
}
