import { useState } from 'react';
import { Button, Switch, TextField } from '@/shared/ui';
import { useDeviceTypes } from '../../api/usePlaces';
import type { DeviceWithExercises } from '../../types';
import { PickerTile } from './PickerTile';

/**
 * The device type catalogue for setting up a place: pick every type that exists here
 * (multi-select); types already here open their device instead.
 */
export function DeviceTypeGrid({
  devices,
  selected,
  onToggle,
  onOpenDevice,
  onNewType,
}: {
  devices: DeviceWithExercises[];
  selected: Set<string>;
  onToggle: (typeId: string) => void;
  onOpenDevice: (deviceId: string) => void;
  onNewType: (name: string) => void;
}) {
  const types = useDeviceTypes();
  const [query, setQuery] = useState('');
  const term = query.trim().toLowerCase();
  const here = new Map(devices.map((device) => [device.typeId, device.id]));
  const shown = (types.data ?? []).filter(
    (type) =>
      !term ||
      type.name.toLowerCase().includes(term) ||
      type.exercises.some((exercise) => exercise.name.toLowerCase().includes(term)),
  );
  // Types not here yet first; the ones already here at the end.
  shown.sort((a, b) => Number(here.has(a.id)) - Number(here.has(b.id)));

  return (
    <div className="flex flex-col gap-3">
      <p className="text-subhead text-text-muted">
        Wähl alle Geräte, die es hier gibt. Du kannst später jederzeit weitere hinzufügen.
      </p>
      <TextField
        label="Gerät suchen"
        value={query}
        autoCorrect="off"
        onChange={(event) => {
          setQuery(event.target.value);
        }}
      />
      <div className="grid grid-cols-2 gap-2">
        {shown.map((type) => {
          const deviceId = here.get(type.id);
          return (
            <PickerTile
              key={type.id}
              title={type.name}
              subtitle={
                deviceId
                  ? 'schon hier ›'
                  : type.exercises.length > 0
                    ? type.exercises.map((exercise) => exercise.name).join(' · ')
                    : 'noch keine Übungen'
              }
              selected={selected.has(type.id)}
              muted={deviceId !== undefined}
              onClick={() => {
                if (deviceId) onOpenDevice(deviceId);
                else onToggle(type.id);
              }}
            />
          );
        })}
      </div>
      {!types.isPending && shown.length === 0 && (
        <p className="text-subhead text-text-muted">Kein Gerätetyp gefunden.</p>
      )}
      <Button
        variant="secondary"
        onClick={() => {
          onNewType(query.trim());
        }}
      >
        {term && shown.length === 0 ? `„${query.trim()}“ als neuen Typ anlegen` : 'Neuer Gerätetyp'}
      </Button>
    </div>
  );
}

export interface NewTypeValues {
  name: string;
  weightStep: number | null;
  comparable: boolean;
}

/** A device type that is not in the catalogue yet (it becomes available for every place). */
export function NewDeviceTypeForm({
  initialName,
  pending,
  error,
  onSubmit,
}: {
  initialName: string;
  pending: boolean;
  error: string | null;
  onSubmit: (values: NewTypeValues) => void;
}) {
  const [name, setName] = useState(initialName);
  const [step, setStep] = useState('2,5');
  const [comparable, setComparable] = useState(false);
  const stepValue = step.trim() === '' ? null : Number(step.replace(',', '.'));
  const stepValid = stepValue === null || (Number.isFinite(stepValue) && stepValue > 0);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ name, weightStep: stepValue, comparable });
      }}
    >
      <p className="text-subhead text-text-muted">
        Ein Gerätetyp gilt für alle Studios. Übungen ordnest du danach zu.
      </p>
      <TextField
        label="Name des Gerätetyps"
        placeholder="z. B. T-Bar-Rudern"
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
      {error && (
        <p role="alert" className="text-footnote text-danger">
          {error}
        </p>
      )}
      <Button
        type="submit"
        missing={
          name.trim().length < 2
            ? 'Gib dem Gerät einen Namen.'
            : !stepValid
              ? 'Die Gewichtsschritte müssen eine Zahl über 0 sein.'
              : null
        }
        loading={pending}
      >
        Anlegen und Übungen zuordnen
      </Button>
    </form>
  );
}
