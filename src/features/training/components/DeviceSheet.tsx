import { useState } from 'react';
import { Button, Sheet, Switch, TextField } from '@/shared/ui';
import { useDeviceSetting, useSaveDeviceSetting, useUpdateDevice } from '../api/usePlaces';
import type { Device, ExerciseSummary } from '../types';

export interface DeviceSheetProps {
  target: { device: Device; exercise: ExerciseSummary } | null;
  onClose: () => void;
}

/** My setting for this device and exercise, plus the device's weight steps. */
export function DeviceSheet({ target, onClose }: DeviceSheetProps) {
  return (
    <Sheet
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={target?.device.name ?? 'Gerät'}
    >
      {target && (
        <DeviceForm
          key={`${target.device.id}:${target.exercise.id}`}
          device={target.device}
          exercise={target.exercise}
          onDone={onClose}
        />
      )}
    </Sheet>
  );
}

function DeviceForm({
  device,
  exercise,
  onDone,
}: {
  device: Device;
  exercise: ExerciseSummary;
  onDone: () => void;
}) {
  const current = useDeviceSetting(device.id, exercise.id).data ?? '';
  const saveSetting = useSaveDeviceSetting(device.id, exercise.id);
  const updateDevice = useUpdateDevice();
  const [setting, setSetting] = useState<string | null>(null);
  const [name, setName] = useState(device.name);
  const [step, setStep] = useState(
    device.weightStep === null ? '' : String(device.weightStep).replace('.', ','),
  );
  const [comparable, setComparable] = useState(device.comparable);
  const stepValue = step.trim() === '' ? null : Number(step.replace(',', '.'));
  const deviceChanged =
    name.trim() !== device.name ||
    stepValue !== device.weightStep ||
    comparable !== device.comparable;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (setting !== null && setting !== current) saveSetting.mutate(setting);
        if (deviceChanged && name.trim().length >= 2 && (stepValue === null || stepValue > 0)) {
          updateDevice.mutate(
            { ...device, name, weightStep: stepValue, comparable },
            { onSuccess: onDone },
          );
        } else {
          onDone();
        }
      }}
    >
      <TextField
        label={`Meine Einstellung für ${exercise.name}`}
        placeholder="z. B. Sitz 4, Höhe 12"
        maxLength={80}
        value={setting ?? current}
        onChange={(event) => {
          setSetting(event.target.value);
        }}
        hint="Nur für dich sichtbar."
      />
      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <span className="text-footnote font-medium text-text-muted">Gerät</span>
        <TextField
          label="Name"
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
          hint="Um so viel springen die ‹ › Pfeile, z. B. 2,5 oder 1,25."
        />
        <Switch
          label="Überall vergleichbar"
          description="Für Kurzhanteln, Bank, Stange: ein Verlauf über alle Studios. Aus für Maschinen."
          checked={comparable}
          onCheckedChange={setComparable}
        />
        {updateDevice.isError && (
          <p role="alert" className="text-footnote text-danger">
            Das Gerät kann nur ändern, wer es angelegt hat.
          </p>
        )}
      </div>
      <Button type="submit" loading={saveSetting.isPending || updateDevice.isPending}>
        Speichern
      </Button>
    </form>
  );
}
