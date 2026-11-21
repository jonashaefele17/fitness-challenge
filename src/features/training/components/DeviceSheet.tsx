import { useState } from 'react';
import { Button, Chip, Sheet, Switch, TextField } from '@/shared/ui';
import { useDeviceSetting, useSaveDeviceSetting, useUpdateDevice } from '../api/usePlaces';
import type { Device, DeviceSettingValues, ExerciseSummary } from '../types';

export interface DeviceSheetProps {
  target: { device: Device; exercise: ExerciseSummary } | null;
  onClose: () => void;
}

/** My values for the device's settings, plus the device itself (fields, weight steps). */
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
  const saved = useDeviceSetting(device.id, exercise.id).data ?? {};
  const saveValues = useSaveDeviceSetting(device.id, exercise.id);
  const updateDevice = useUpdateDevice();
  const [values, setValues] = useState<DeviceSettingValues | null>(null);
  const [fields, setFields] = useState(device.settingFields);
  const [newField, setNewField] = useState('');
  const [name, setName] = useState(device.name);
  const [step, setStep] = useState(
    device.weightStep === null ? '' : String(device.weightStep).replace('.', ','),
  );
  const [comparable, setComparable] = useState(device.comparable);

  const current = values ?? saved;
  const stepValue = step.trim() === '' ? null : Number(step.replace(',', '.'));
  const deviceChanged =
    name.trim() !== device.name ||
    stepValue !== device.weightStep ||
    comparable !== device.comparable ||
    fields.join('\n') !== device.settingFields.join('\n');

  function addField() {
    const label = newField.trim();
    if (label && !fields.includes(label) && fields.length < 6) setFields([...fields, label]);
    setNewField('');
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (values !== null) {
          // Only keep values for fields the device still has.
          saveValues.mutate(
            Object.fromEntries(fields.map((field) => [field, values[field] ?? ''])),
          );
        }
        if (deviceChanged && name.trim().length >= 2 && (stepValue === null || stepValue > 0)) {
          updateDevice.mutate(
            {
              before: device,
              after: { ...device, name, weightStep: stepValue, comparable, settingFields: fields },
            },
            { onSuccess: onDone },
          );
        } else {
          onDone();
        }
      }}
    >
      {fields.length > 0 ? (
        <div className="flex flex-col gap-3">
          <span className="text-footnote font-medium text-text-muted">
            Meine Einstellungen für {exercise.name}
          </span>
          <div className="grid grid-cols-2 gap-3">
            {fields.map((field) => (
              <TextField
                key={field}
                label={field}
                inputMode="decimal"
                maxLength={20}
                value={current[field] ?? ''}
                onChange={(event) => {
                  setValues({ ...current, [field]: event.target.value });
                }}
              />
            ))}
          </div>
        </div>
      ) : (
        <p className="text-subhead text-text-muted">
          Dieses Gerät hat keine Einstellungen. Falls doch (Sitz, Polster, Höhe …), füg sie unten
          hinzu.
        </p>
      )}

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <span className="text-footnote font-medium text-text-muted">Gerät</span>
        <p className="text-footnote text-text-subtle">
          Name, Einstellungen und „vergleichbar“ gelten für jeden {device.name} in allen Studios,
          die Gewichtsstufe nur für dieses Gerät.
        </p>
        <div className="flex flex-col gap-2">
          <span className="text-footnote text-text-muted">Einstellungen des Geräts</span>
          <div className="flex flex-wrap gap-2">
            {fields.map((field) => (
              <Chip
                key={field}
                aria-label={`${field} entfernen`}
                onClick={() => {
                  setFields(fields.filter((other) => other !== field));
                }}
              >
                {field} ×
              </Chip>
            ))}
          </div>
          {fields.length < 6 && (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <TextField
                  label="Neue Einstellung"
                  placeholder="z. B. Rückenlehne"
                  maxLength={20}
                  value={newField}
                  onChange={(event) => {
                    setNewField(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addField();
                    }
                  }}
                />
              </div>
              <Button variant="secondary" disabled={!newField.trim()} onClick={addField}>
                + Feld
              </Button>
            </div>
          )}
        </div>
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
          hint={`Um so viel springt das Gewicht, z. B. 2,5 oder 1,25. Leer: Standard des Typs${
            device.typeWeightStep === null
              ? ''
              : ` (${String(device.typeWeightStep).replace('.', ',')})`
          }.`}
        />
        <Switch
          label="Überall vergleichbar"
          description="Für Kurzhanteln, Bank, Stange: ein Verlauf über alle Studios. Aus für Maschinen."
          checked={comparable}
          onCheckedChange={setComparable}
        />
        {updateDevice.isError && (
          <p role="alert" className="text-footnote text-danger">
            Speichern hat nicht geklappt.
          </p>
        )}
      </div>
      <Button type="submit" loading={saveValues.isPending || updateDevice.isPending}>
        Speichern
      </Button>
    </form>
  );
}
