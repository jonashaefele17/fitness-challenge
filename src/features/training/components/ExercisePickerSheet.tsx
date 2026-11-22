import { useState, type ReactNode } from 'react';
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
  /**
   * Pick several (routines): the picker stays open, tapping a chosen exercise again
   * removes it, "Fertig" closes. Without it one tap picks and closes.
   */
  selectedIds?: string[] | undefined;
  onUnpick?: ((exercise: ExerciseSummary) => void) | undefined;
  /** Above the search (e.g. "Für alle" while training together). */
  header?: ReactNode;
}

type Tab = 'devices' | 'exercises';
type SubView = Exclude<View, { kind: 'browse' }>;
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
  selectedIds,
  onUnpick,
  header,
}: ExercisePickerSheetProps) {
  const multiple = selectedIds !== undefined;
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
    if (multiple) setView({ kind: 'browse' });
    else close();
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

  // Steps below the list open as a sheet stacked on it (closing it returns to the list).
  // The last step stays rendered while that sheet slides away.
  const [lastSub, setLastSub] = useState<SubView | null>(null);
  if (view.kind !== 'browse' && view !== lastSub) setLastSub(view);
  const sub: SubView | null = view.kind !== 'browse' ? view : lastSub;

  const device =
    sub?.kind === 'device' || sub?.kind === 'link'
      ? deviceList.find((d) => d.id === sub.deviceId)
      : undefined;

  // Back within the stacked sheet; its first step goes back by closing it.
  const back: View | null =
    sub?.kind === 'link'
      ? { kind: 'device', deviceId: sub.deviceId }
      : sub?.kind === 'new-exercise' && sub.forDeviceId
        ? { kind: 'link', deviceId: sub.forDeviceId }
        : sub?.kind === 'new-type'
          ? { kind: 'add-devices' }
          : sub?.kind === 'history' && sub.deviceId
            ? { kind: 'device', deviceId: sub.deviceId }
            : null;

  const subTitle =
    sub?.kind === 'device' || sub?.kind === 'link'
      ? (device?.name ?? 'Gerät')
      : sub?.kind === 'add-devices'
        ? `Geräte · ${place?.name ?? ''}`
        : sub?.kind === 'new-type'
          ? 'Neuer Gerätetyp'
          : sub?.kind === 'new-exercise'
            ? 'Neue Übung'
            : sub?.kind === 'new-focus'
              ? 'Eigener Fokus'
              : sub?.kind === 'history'
                ? sub.exercise.name
                : 'Übung';

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      title={title}
      className="min-h-sheet-min"
      footer={
        multiple ? (
          <Button className="w-full" onClick={close}>
            {selectedIds.length === 1
              ? 'Fertig · 1 Übung'
              : `Fertig · ${String(selectedIds.length)} Übungen`}
          </Button>
        ) : undefined
      }
    >
      {
        <div className="flex flex-col gap-4">
          {header}
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
              selectedIds={selectedIds ?? []}
              onPick={(exercise) => {
                if (multiple && selectedIds.includes(exercise.id)) onUnpick?.(exercise);
                else pick(exercise, null);
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
      }

      <Sheet
        open={open && view.kind !== 'browse'}
        onOpenChange={(next) => {
          if (!next) setView({ kind: 'browse' });
        }}
        title={subTitle}
        className="min-h-sheet-min"
        footer={
          sub?.kind === 'add-devices' && selectedTypes.size > 0 ? (
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

        {sub?.kind === 'device' && device && place && (
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

        {sub?.kind === 'history' && (
          <ExerciseHistory
            exercise={sub.exercise}
            device={deviceList.find((d) => d.id === sub.deviceId) ?? null}
          />
        )}

        {sub?.kind === 'link' && device && (
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

        {sub?.kind === 'add-devices' && place && (
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

        {sub?.kind === 'new-type' && (
          <NewDeviceTypeForm
            initialName={sub.initialName}
            pending={addDevices.isPending}
            error={typeError}
            onSubmit={createType}
          />
        )}

        {sub?.kind === 'new-exercise' && (
          <NewExerciseForDevice
            catalog={catalog}
            device={deviceList.find((d) => d.id === sub.forDeviceId) ?? null}
            initialName={query}
            onCancel={() => {
              setView(back ?? { kind: 'browse' });
            }}
            onCreated={(exercise) => {
              if (sub.forDeviceId) {
                setView({ kind: 'device', deviceId: sub.forDeviceId });
              } else {
                pick(exercise, null);
              }
            }}
          />
        )}

        {sub?.kind === 'new-focus' && (
          <NewFocusForm
            onCreated={(id) => {
              onFocusChange(id);
              setView({ kind: 'browse' });
            }}
          />
        )}
      </Sheet>
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
  selectedIds,
  onPick,
  onCreate,
  onHistory,
}: {
  query: string;
  catalog: ExerciseCatalog;
  focus: TrainingFocus | null;
  selectedIds: string[];
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
              selected={selectedIds.includes(exercise.id)}
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
      {/* Always reachable: a catalogue that already has exercises still needs new ones. */}
      <Button variant="secondary" onClick={onCreate}>
        {query.trim().length >= 2 && !exactMatch
          ? `„${query.trim()}“ neu anlegen`
          : 'Neue Übung anlegen'}
      </Button>
    </div>
  );
}
