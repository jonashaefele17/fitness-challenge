import { useState } from 'react';
import { cn } from '@/shared/lib';
import { Button, Sheet, TextField } from '@/shared/ui';
import { linkExerciseToType, useAddDevices, useDevicesAt, useDeviceTypes } from '../api/usePlaces';
import { useSetItemDevice } from '../api/useWorkout';
import type { Device, Place, WorkoutItem } from '../types';
import { NewDeviceTypeForm } from './picker/AddDevices';
import { useLinkUndo } from './picker/useLinkUndo';

export interface DevicePickerSheetProps {
  item: WorkoutItem | null;
  place: Place | null;
  onClose: () => void;
}

/** Pick the device used for an exercise here, or add one from the device type catalogue. */
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

type Step = 'here' | 'catalogue' | 'new-type';

function Picker({ item, place, onDone }: { item: WorkoutItem; place: Place; onDone: () => void }) {
  const devices = useDevicesAt(place.id);
  const types = useDeviceTypes().data ?? [];
  const setDevice = useSetItemDevice();
  const announce = useLinkUndo();
  const add = useAddDevices(place.id);
  const [step, setStep] = useState<Step>('here');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const deviceList = devices.data ?? [];
  const offers = (device: { exercises: { id: string }[] }) =>
    device.exercises.some((e) => e.id === item.exercise.id);

  // Devices that already offer this exercise come first.
  const sorted = [...deviceList].sort((a, b) => Number(offers(b)) - Number(offers(a)));

  function choose(device: Device | null) {
    setDevice.mutate({ itemId: item.id, device });
    if (device) {
      // Choosing a device also teaches its type this exercise; a mis-tap can be undone.
      linkExerciseToType(device.typeId, item.exercise.id).then(
        (isNew) => {
          announce(isNew, item.exercise, device);
        },
        () => undefined,
      );
    }
    onDone();
  }

  /** Once the new device shows up in the list, pick it. */
  async function chooseAdded(deviceId: string | undefined) {
    const refreshed = await devices.refetch();
    const added = refreshed.data?.find((device) => device.id === deviceId);
    if (added) choose(added);
  }

  if (step === 'new-type') {
    return (
      <NewDeviceTypeForm
        initialName={query.trim()}
        pending={add.isPending}
        error={error}
        onSubmit={(values) => {
          setError(null);
          add.mutate(
            { typeIds: [], newType: values },
            {
              onSuccess: (ids) => void chooseAdded([...ids.values()][0]),
              onError: () => {
                setError('Anlegen hat nicht geklappt (gibt es den Typ schon?).');
              },
            },
          );
        }}
      />
    );
  }

  if (step === 'catalogue') {
    const here = new Set(deviceList.map((device) => device.typeId));
    const term = query.trim().toLowerCase();
    const candidates = types
      .filter((type) => !here.has(type.id))
      .filter((type) => !term || type.name.toLowerCase().includes(term))
      .sort(
        (a, b) =>
          Number(b.exercises.some((e) => e.id === item.exercise.id)) -
          Number(a.exercises.some((e) => e.id === item.exercise.id)),
      );
    return (
      <div className="flex flex-col gap-3">
        <p className="text-subhead text-text-muted">Welches Gerät gibt es in {place.name}?</p>
        <TextField
          label="Gerät suchen"
          value={query}
          autoCorrect="off"
          onChange={(event) => {
            setQuery(event.target.value);
          }}
        />
        <ul className="-mx-gutter flex flex-col">
          {candidates.map((type) => (
            <li key={type.id}>
              <button
                type="button"
                disabled={add.isPending}
                onClick={() => {
                  add.mutate(
                    { typeIds: [type.id] },
                    { onSuccess: (ids) => void chooseAdded(ids.get(type.id)) },
                  );
                }}
                className="flex min-h-tap w-full items-center justify-between gap-3 px-gutter py-2.5 text-left active:bg-surface-2"
              >
                <span className="text-body">{type.name}</span>
                {type.exercises.some((e) => e.id === item.exercise.id) && (
                  <span className="text-footnote text-accent">passt zur Übung</span>
                )}
              </button>
            </li>
          ))}
        </ul>
        <Button
          variant="secondary"
          onClick={() => {
            setStep('new-type');
          }}
        >
          Neuer Gerätetyp
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setStep('here');
          }}
        >
          Zurück
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        {sorted.map((device) => {
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
                {offers(device) ? 'passt zur Übung' : `${String(device.exercises.length)} Übungen`}
              </span>
            </button>
          );
        })}
      </div>
      <Button
        variant="secondary"
        onClick={() => {
          setStep('catalogue');
        }}
      >
        + Weiteres Gerät hier
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
