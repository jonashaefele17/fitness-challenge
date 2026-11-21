import { useState } from 'react';
import { Button, SegmentedControl, Sheet, TextField } from '@/shared/ui';
import {
  fitsFocus,
  historyFor,
  useExerciseOverview,
  useExerciseSearch,
  usePrimaryMuscleIndex,
  useTrainingFocuses,
} from '../api/useCatalog';
import { useAddDevices, useDevicesAt, useLinkExercise } from '../api/usePlaces';
import type {
  Device,
  ExerciseCatalog,
  DeviceWithExercises,
  ExerciseSummary,
  Place,
  TrainingFocus,
} from '../types';
import { measureLabel } from '../measures';
import { CreateExerciseForm } from './CreateExerciseForm';
import { DeviceTypeGrid, NewDeviceTypeForm, type NewTypeValues } from './picker/AddDevices';
import { DeviceDetails } from './picker/DeviceDetails';
import { ExerciseHistory } from './history/ExerciseHistory';
import { FocusChips, NewFocusForm } from './picker/FocusChips';
import { lastDoneText } from './picker/historyText';
import { PickerTile } from './picker/PickerTile';
import { useLinkUndo } from './picker/useLinkUndo';

export interface ExercisePickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  /** Current place; its devices make up the "Geräte" tab. */
  place: Place | null;
  /** Training focus of the workout (filters by primary muscles); null: everything. */
  focusId: string | null;
  onFocusChange: (focusId: string | null) => void;
  /** Exercise catalogue (mobility: own exercises, no devices). */
  catalog?: ExerciseCatalog | undefined;
  /** Focuses that make sense here (from the training type); null: all. */
  allowedFocusIds?: string[] | null | undefined;
  onPick: (exercise: ExerciseSummary, device: Device | null) => void;
}

type Tab = 'devices' | 'exercises';
type View =
  | { kind: 'browse' }
  | { kind: 'device'; deviceId: string }
  | { kind: 'link'; deviceId: string }
  | { kind: 'add-devices' }
  | { kind: 'new-type'; initialName: string }
  | { kind: 'new-exercise'; forDeviceId: string | null }
  | { kind: 'new-focus' }
  | { kind: 'history'; exercise: ExerciseSummary; deviceId: string | null };

/**
 * Two ways in: the devices at this place (one tap for single-exercise devices, details for
 * the others) or all exercises without a device (e.g. training somewhere else). A focus
 * (Push, Pull …) narrows both. Every exercise shows when it was last done and a mini trend.
 */
export function ExercisePickerSheet({
  open,
  onOpenChange,
  title = 'Übung hinzufügen',
  place: placeProp,
  focusId,
  onFocusChange,
  catalog = 'strength',
  allowedFocusIds = null,
  onPick,
}: ExercisePickerSheetProps) {
  // Mobility has no devices: the picker is only the mobility catalogue.
  const place = catalog === 'strength' ? placeProp : null;
  const devices = useDevicesAt(place?.id ?? null);
  const focus = useTrainingFocuses().data?.find((f) => f.id === focusId) ?? null;
  const addDevices = useAddDevices(place?.id ?? '');
  const [tab, setTab] = useState<Tab | null>(null);
  const [view, setView] = useState<View>({ kind: 'browse' });
  const [query, setQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [typeError, setTypeError] = useState<string | null>(null);
  const deviceList = devices.data ?? [];
  const activeTab: Tab = tab ?? (place ? 'devices' : 'exercises');

  function close() {
    setTab(null);
    setView({ kind: 'browse' });
    setQuery('');
    setSelectedTypes(new Set());
    onOpenChange(false);
  }

  function pick(exercise: ExerciseSummary, device: Device | null) {
    onPick(exercise, device);
    close();
  }

  function addSelected() {
    const typeIds = [...selectedTypes];
    addDevices.mutate(
      { typeIds },
      {
        onSuccess: (ids) => {
          setSelectedTypes(new Set());
          const only = typeIds.length === 1 ? ids.get(typeIds[0] ?? '') : undefined;
          setView(only ? { kind: 'device', deviceId: only } : { kind: 'browse' });
        },
      },
    );
  }

  function createType(values: NewTypeValues) {
    setTypeError(null);
    addDevices.mutate(
      { typeIds: [], newType: values },
      {
        onSuccess: (ids) => {
          const deviceId = [...ids.values()][0];
          setView(deviceId ? { kind: 'link', deviceId } : { kind: 'add-devices' });
        },
        onError: (error) => {
          setTypeError(
            'code' in error && error.code === '23505'
              ? 'Diesen Gerätetyp gibt es schon – wähl ihn aus der Liste.'
              : 'Anlegen hat nicht geklappt.',
          );
        },
      },
    );
  }

  const device =
    view.kind === 'device' || view.kind === 'link'
      ? deviceList.find((d) => d.id === view.deviceId)
      : undefined;

  const back: View | null =
    view.kind === 'browse'
      ? null
      : view.kind === 'link'
        ? { kind: 'device', deviceId: view.deviceId }
        : view.kind === 'new-exercise' && view.forDeviceId
          ? { kind: 'link', deviceId: view.forDeviceId }
          : view.kind === 'new-type'
            ? { kind: 'add-devices' }
            : view.kind === 'history' && view.deviceId
              ? { kind: 'device', deviceId: view.deviceId }
              : { kind: 'browse' };

  const sheetTitle =
    view.kind === 'device' || view.kind === 'link'
      ? (device?.name ?? 'Gerät')
      : view.kind === 'add-devices'
        ? `Geräte · ${place?.name ?? ''}`
        : view.kind === 'new-type'
          ? 'Neuer Gerätetyp'
          : view.kind === 'new-exercise'
            ? 'Neue Übung'
            : view.kind === 'new-focus'
              ? 'Eigener Fokus'
              : view.kind === 'history'
                ? view.exercise.name
                : title;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      title={sheetTitle}
      className="min-h-sheet-min"
      footer={
        view.kind === 'add-devices' && selectedTypes.size > 0 ? (
          <Button className="w-full" loading={addDevices.isPending} onClick={addSelected}>
            {selectedTypes.size === 1
              ? '1 Gerät hinzufügen'
              : `${String(selectedTypes.size)} Geräte hinzufügen`}
          </Button>
        ) : undefined
      }
    >
      {back && (
        <button
          type="button"
          onClick={() => {
            setView(back);
          }}
          className="-mt-2 mb-2 min-h-tap text-subhead font-semibold text-accent"
        >
          ‹ Zurück
        </button>
      )}

      {view.kind === 'browse' && (
        <div className="flex flex-col gap-4">
          <TextField
            label={activeTab === 'devices' ? 'Gerät oder Übung suchen' : 'Übung suchen'}
            value={query}
            autoCorrect="off"
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />
          <FocusChips
            focusId={focusId}
            allowedIds={allowedFocusIds}
            onChange={onFocusChange}
            onCreate={() => {
              setView({ kind: 'new-focus' });
            }}
          />
          {place && (
            <SegmentedControl
              label="Ansicht"
              value={activeTab}
              onChange={setTab}
              options={[
                { value: 'devices', label: `Geräte · ${place.name}` },
                { value: 'exercises', label: 'Übungen' },
              ]}
            />
          )}
          {activeTab === 'devices' && place ? (
            <DevicesGrid
              devices={deviceList}
              loading={devices.isPending}
              placeName={place.name}
              query={query}
              focus={focus}
              onPick={pick}
              onOpenDevice={(deviceId) => {
                setView({ kind: 'device', deviceId });
              }}
              onAddDevices={() => {
                setView({ kind: 'add-devices' });
              }}
            />
          ) : (
            <ExercisesGrid
              query={query}
              catalog={catalog}
              focus={focus}
              onPick={(exercise) => {
                pick(exercise, null);
              }}
              onCreate={() => {
                setView({ kind: 'new-exercise', forDeviceId: null });
              }}
              onHistory={(exercise) => {
                setView({ kind: 'history', exercise, deviceId: null });
              }}
            />
          )}
        </div>
      )}

      {view.kind === 'device' && device && place && (
        <DeviceDetails
          device={device}
          placeId={place.id}
          focus={focus}
          onPick={(exercise) => {
            pick(exercise, device);
          }}
          onAddExercise={() => {
            setView({ kind: 'link', deviceId: device.id });
          }}
          onHistory={(exercise) => {
            setView({ kind: 'history', exercise, deviceId: device.id });
          }}
        />
      )}

      {view.kind === 'history' && (
        <ExerciseHistory
          exercise={view.exercise}
          device={deviceList.find((d) => d.id === view.deviceId) ?? null}
        />
      )}

      {view.kind === 'link' && device && (
        <LinkExercise
          device={device}
          onLinked={() => {
            setView({ kind: 'device', deviceId: device.id });
          }}
          onCreate={() => {
            setView({ kind: 'new-exercise', forDeviceId: device.id });
          }}
        />
      )}

      {view.kind === 'add-devices' && place && (
        <DeviceTypeGrid
          devices={deviceList}
          selected={selectedTypes}
          onToggle={(typeId) => {
            setSelectedTypes((current) => {
              const next = new Set(current);
              if (next.has(typeId)) next.delete(typeId);
              else next.add(typeId);
              return next;
            });
          }}
          onOpenDevice={(deviceId) => {
            setView({ kind: 'device', deviceId });
          }}
          onNewType={(name) => {
            setTypeError(null);
            setView({ kind: 'new-type', initialName: name });
          }}
        />
      )}

      {view.kind === 'new-type' && (
        <NewDeviceTypeForm
          initialName={view.initialName}
          pending={addDevices.isPending}
          error={typeError}
          onSubmit={createType}
        />
      )}

      {view.kind === 'new-exercise' && (
        <NewExerciseForDevice
          catalog={catalog}
          device={deviceList.find((d) => d.id === view.forDeviceId) ?? null}
          initialName={query}
          onCancel={() => {
            setView(back ?? { kind: 'browse' });
          }}
          onCreated={(exercise) => {
            if (view.forDeviceId) {
              setView({ kind: 'device', deviceId: view.forDeviceId });
            } else {
              pick(exercise, null);
            }
          }}
        />
      )}

      {view.kind === 'new-focus' && (
        <NewFocusForm
          onCreated={(id) => {
            onFocusChange(id);
            setView({ kind: 'browse' });
          }}
        />
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Devices tab
// ---------------------------------------------------------------------------
function DevicesGrid({
  devices,
  loading,
  placeName,
  query,
  focus,
  onPick,
  onOpenDevice,
  onAddDevices,
}: {
  devices: DeviceWithExercises[];
  loading: boolean;
  placeName: string;
  query: string;
  focus: TrainingFocus | null;
  onPick: (exercise: ExerciseSummary, device: Device) => void;
  onOpenDevice: (deviceId: string) => void;
  onAddDevices: () => void;
}) {
  const overview = useExerciseOverview().data;
  const muscles = usePrimaryMuscleIndex();
  const term = query.trim().toLowerCase();
  const shown = devices.filter(
    (device) =>
      (!term ||
        device.name.toLowerCase().includes(term) ||
        device.exercises.some((exercise) => exercise.name.toLowerCase().includes(term))) &&
      (device.exercises.length === 0 ||
        device.exercises.some((exercise) => fitsFocus(focus, muscles.get(exercise.id)))),
  );

  if (!loading && devices.length === 0) {
    return (
      <div className="flex flex-col gap-3 rounded-card border border-dashed border-border p-4">
        <p className="text-subhead text-text-muted">
          Für {placeName} sind noch keine Geräte eingerichtet. Wähl einmal aus, was es hier gibt –
          danach siehst du nur noch diese Geräte.
        </p>
        <Button onClick={onAddDevices}>Studio einrichten</Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {shown.map((device) => {
        const only = device.exercises.length === 1 ? device.exercises[0] : undefined;
        const history = only ? historyFor(overview, only.id, device) : undefined;
        return (
          <PickerTile
            key={device.id}
            title={device.name}
            subtitle={
              only
                ? history
                  ? lastDoneText(history, only)
                  : only.name
                : device.exercises.length === 0
                  ? 'Übung zuordnen ›'
                  : `${String(device.exercises.length)} Übungen ›`
            }
            trend={history?.trend}
            onClick={() => {
              if (only) onPick(only, device);
              else onOpenDevice(device.id);
            }}
            onInfo={() => {
              onOpenDevice(device.id);
            }}
          />
        );
      })}
      <button
        type="button"
        onClick={onAddDevices}
        className="flex min-h-36 flex-col items-center justify-center gap-1 rounded-card border border-dashed border-border text-subhead font-semibold text-accent active:bg-surface-2"
      >
        <span className="text-title-2">+</span>
        Gerät
      </button>
    </div>
  );
}

function LinkExercise({
  device,
  onLinked,
  onCreate,
}: {
  device: DeviceWithExercises;
  onLinked: () => void;
  onCreate: () => void;
}) {
  const [query, setQuery] = useState('');
  const search = useExerciseSearch(query);
  const link = useLinkExercise();
  const announce = useLinkUndo();
  const linked = new Set(device.exercises.map((exercise) => exercise.id));
  const results = (search.data ?? []).filter((exercise) => !linked.has(exercise.id));

  return (
    <div className="flex flex-col gap-3">
      <p className="text-subhead text-text-muted">
        Die Übung gilt für jeden {device.name}, auch in anderen Studios.
      </p>
      <TextField
        label={`Übung für ${device.name}`}
        value={query}
        autoCorrect="off"
        onChange={(event) => {
          setQuery(event.target.value);
        }}
      />
      <ul className="-mx-gutter flex flex-col">
        {results.map((exercise) => (
          <li key={exercise.id}>
            <button
              type="button"
              disabled={link.isPending}
              onClick={() => {
                link.mutate(
                  { device, exerciseId: exercise.id },
                  {
                    onSuccess: (isNew) => {
                      announce(isNew, exercise, device);
                      onLinked();
                    },
                  },
                );
              }}
              className="flex min-h-tap w-full items-center justify-between gap-3 px-gutter py-2.5 text-left active:bg-surface-2"
            >
              <span className="text-body">{exercise.name}</span>
              <span className="text-footnote text-text-subtle">
                {measureLabel[exercise.measure]}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {link.isError && (
        <p role="alert" className="text-footnote text-danger">
          Zuordnen hat nicht geklappt.
        </p>
      )}
      <Button variant="secondary" onClick={onCreate}>
        Neue Übung anlegen
      </Button>
    </div>
  );
}

function NewExerciseForDevice({
  catalog,
  device,
  initialName,
  onCancel,
  onCreated,
}: {
  catalog: ExerciseCatalog;
  device: Device | null;
  initialName: string;
  onCancel: () => void;
  onCreated: (exercise: ExerciseSummary) => void;
}) {
  const link = useLinkExercise();
  const announce = useLinkUndo();
  return (
    <CreateExerciseForm
      initialName={initialName}
      catalog={catalog}
      onCancel={onCancel}
      onCreated={(exercise) => {
        if (device) {
          link.mutate(
            { device, exerciseId: exercise.id },
            {
              onSuccess: (isNew) => {
                announce(isNew, exercise, device);
              },
              onSettled: () => {
                onCreated(exercise);
              },
            },
          );
        } else {
          onCreated(exercise);
        }
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Exercises tab (no device)
// ---------------------------------------------------------------------------
function ExercisesGrid({
  query,
  catalog,
  focus,
  onPick,
  onCreate,
  onHistory,
}: {
  query: string;
  catalog: ExerciseCatalog;
  focus: TrainingFocus | null;
  onPick: (exercise: ExerciseSummary) => void;
  onCreate: () => void;
  onHistory: (exercise: ExerciseSummary) => void;
}) {
  const search = useExerciseSearch(query, catalog);
  const overview = useExerciseOverview().data;
  const muscles = usePrimaryMuscleIndex();
  const results = search.data ?? [];
  const fitting = results.filter((exercise) => fitsFocus(focus, muscles.get(exercise.id)));
  // Most recently done first (in the shared scope), then alphabetical.
  const sorted = [...fitting].sort((a, b) => {
    const la = historyFor(overview, a.id, null)?.lastDoneAt ?? '';
    const lb = historyFor(overview, b.id, null)?.lastDoneAt ?? '';
    return lb.localeCompare(la) || a.name.localeCompare(b.name, 'de');
  });
  const exactMatch = results.some(
    (exercise) => exercise.name.toLowerCase() === query.trim().toLowerCase(),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        {sorted.map((exercise) => {
          const history = historyFor(overview, exercise.id, null);
          const labels = muscles.get(exercise.id)?.map((m) => m.label);
          return (
            <PickerTile
              key={exercise.id}
              title={exercise.name}
              subtitle={
                history
                  ? lastDoneText(history, exercise)
                  : labels
                    ? labels.join(' · ')
                    : `${measureLabel[exercise.measure]} · Muskelgruppe fehlt`
              }
              trend={history?.trend}
              onClick={() => {
                onPick(exercise);
              }}
              onInfo={
                history
                  ? () => {
                      onHistory(exercise);
                    }
                  : undefined
              }
            />
          );
        })}
      </div>
      {!search.isPending && results.length === 0 && query.trim().length < 2 && (
        <p className="text-subhead text-text-muted">
          Noch keine Übungen im Katalog. Leg die erste an.
        </p>
      )}
      {focus && results.length > fitting.length && (
        <p className="text-footnote text-text-subtle">
          {results.length - fitting.length} weitere passen nicht zu {focus.name}. „Alle“ zeigt sie.
        </p>
      )}
      {(query.trim().length >= 2 && !exactMatch) || results.length === 0 ? (
        <Button variant="secondary" onClick={onCreate}>
          {query.trim() ? `„${query.trim()}“ neu anlegen` : 'Neue Übung anlegen'}
        </Button>
      ) : null}
    </div>
  );
}
