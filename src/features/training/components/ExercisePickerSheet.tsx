import { useState } from 'react';
import { formatRelativeTime } from '@/shared/lib';
import { Button, SegmentedControl, Sheet, Switch, TextField } from '@/shared/ui';
import {
  historyFor,
  useExerciseOverview,
  useExerciseSearch,
  usePrimaryMuscles,
  type ExerciseHistory,
} from '../api/useCatalog';
import { useCreateEmptyDevice, useDevicesAt, useLinkExercise } from '../api/usePlaces';
import { formatSet } from '../format';
import type { Device, DeviceWithExercises, ExerciseSummary, Place } from '../types';
import { measureLabel } from '../measures';
import { CreateExerciseForm } from './CreateExerciseForm';
import { Sparkline } from './Sparkline';

export interface ExercisePickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  /** Current place; its devices make up the "Geräte" tab. */
  place: Place | null;
  onPick: (exercise: ExerciseSummary, device: Device | null) => void;
}

type Tab = 'devices' | 'exercises';
type View =
  | { kind: 'browse' }
  | { kind: 'device'; deviceId: string }
  | { kind: 'link'; deviceId: string }
  | { kind: 'new-device' }
  | { kind: 'new-exercise'; forDeviceId: string | null };

/**
 * Two ways in: the devices at this place (one tap for single-exercise devices, details for
 * the others) or all exercises without a device (e.g. training somewhere else).
 * Every exercise shows when it was last done and a mini trend.
 */
export function ExercisePickerSheet({
  open,
  onOpenChange,
  title = 'Übung hinzufügen',
  place,
  onPick,
}: ExercisePickerSheetProps) {
  const devices = useDevicesAt(place?.id ?? null).data ?? [];
  const [tab, setTab] = useState<Tab | null>(null);
  const [view, setView] = useState<View>({ kind: 'browse' });
  const [query, setQuery] = useState('');
  const activeTab: Tab = tab ?? (place && devices.length > 0 ? 'devices' : 'exercises');

  function close() {
    setTab(null);
    setView({ kind: 'browse' });
    setQuery('');
    onOpenChange(false);
  }

  function pick(exercise: ExerciseSummary, device: Device | null) {
    onPick(exercise, device);
    close();
  }

  const device =
    view.kind === 'device' || view.kind === 'link'
      ? devices.find((d) => d.id === view.deviceId)
      : undefined;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      title={
        view.kind === 'device' || view.kind === 'link'
          ? (device?.name ?? 'Gerät')
          : view.kind === 'new-device'
            ? 'Neues Gerät'
            : view.kind === 'new-exercise'
              ? 'Neue Übung'
              : title
      }
      className="min-h-sheet-min"
    >
      {view.kind !== 'browse' && (
        <button
          type="button"
          onClick={() => {
            setView(
              view.kind === 'link' || (view.kind === 'new-exercise' && view.forDeviceId)
                ? {
                    kind: 'device',
                    deviceId: view.kind === 'link' ? view.deviceId : (view.forDeviceId ?? ''),
                  }
                : { kind: 'browse' },
            );
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
              devices={devices}
              query={query}
              onPick={pick}
              onOpenDevice={(deviceId) => {
                setView({ kind: 'device', deviceId });
              }}
              onNewDevice={() => {
                setView({ kind: 'new-device' });
              }}
            />
          ) : (
            <ExercisesGrid
              query={query}
              onPick={(exercise) => {
                pick(exercise, null);
              }}
              onCreate={() => {
                setView({ kind: 'new-exercise', forDeviceId: null });
              }}
            />
          )}
        </div>
      )}

      {view.kind === 'device' && device && place && (
        <DeviceDetails
          device={device}
          onPick={(exercise) => {
            pick(exercise, device);
          }}
          onAddExercise={() => {
            setView({ kind: 'link', deviceId: device.id });
          }}
        />
      )}

      {view.kind === 'link' && device && place && (
        <LinkExercise
          device={device}
          placeId={place.id}
          onLinked={() => {
            setView({ kind: 'device', deviceId: device.id });
          }}
          onCreate={() => {
            setView({ kind: 'new-exercise', forDeviceId: device.id });
          }}
        />
      )}

      {view.kind === 'new-device' && place && (
        <NewDeviceForm
          placeId={place.id}
          onCreated={(created) => {
            setView({ kind: 'device', deviceId: created.id });
          }}
        />
      )}

      {view.kind === 'new-exercise' && (
        <NewExerciseForDevice
          placeId={place?.id ?? null}
          deviceId={view.forDeviceId}
          initialName={query}
          onCancel={() => {
            setView({ kind: 'browse' });
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
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Devices tab
// ---------------------------------------------------------------------------
function DevicesGrid({
  devices,
  query,
  onPick,
  onOpenDevice,
  onNewDevice,
}: {
  devices: DeviceWithExercises[];
  query: string;
  onPick: (exercise: ExerciseSummary, device: Device) => void;
  onOpenDevice: (deviceId: string) => void;
  onNewDevice: () => void;
}) {
  const overview = useExerciseOverview().data;
  const term = query.trim().toLowerCase();
  const shown = devices.filter(
    (device) =>
      !term ||
      device.name.toLowerCase().includes(term) ||
      device.exercises.some((exercise) => exercise.name.toLowerCase().includes(term)),
  );

  return (
    <div className="grid grid-cols-2 gap-2">
      {shown.map((device) => {
        const only = device.exercises.length === 1 ? device.exercises[0] : undefined;
        const history = only ? historyFor(overview, only.id, device) : undefined;
        return (
          <Tile
            key={device.id}
            title={device.name}
            subtitle={
              only
                ? history
                  ? lastDoneText(history, only)
                  : 'noch nie gemacht'
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
        onClick={onNewDevice}
        className="flex min-h-36 flex-col items-center justify-center gap-1 rounded-card border border-dashed border-border text-subhead font-semibold text-accent active:bg-surface-2"
      >
        <span className="text-title-2">+</span>
        Gerät anlegen
      </button>
    </div>
  );
}

function DeviceDetails({
  device,
  onPick,
  onAddExercise,
}: {
  device: DeviceWithExercises;
  onPick: (exercise: ExerciseSummary) => void;
  onAddExercise: () => void;
}) {
  const overview = useExerciseOverview().data;
  const muscles = usePrimaryMuscles(device.exercises.map((exercise) => exercise.id));
  return (
    <div className="flex flex-col gap-3">
      <div
        aria-hidden
        className="flex aspect-[5/2] items-center justify-center rounded-card image-backdrop text-large-title font-bold text-accent/70"
      >
        {device.name.charAt(0).toUpperCase()}
      </div>
      {device.exercises.length === 0 && (
        <p className="text-subhead text-text-muted">
          Diesem Gerät ist noch keine Übung zugeordnet.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {device.exercises.map((exercise) => {
          const history = historyFor(overview, exercise.id, device);
          return (
            <Tile
              key={exercise.id}
              title={exercise.name}
              subtitle={
                history
                  ? lastDoneText(history, exercise)
                  : (muscles.get(exercise.id)?.join(' · ') ?? 'noch nie gemacht')
              }
              trend={history?.trend}
              onClick={() => {
                onPick(exercise);
              }}
            />
          );
        })}
      </div>
      <Button variant="secondary" onClick={onAddExercise}>
        + Übung zuordnen
      </Button>
    </div>
  );
}

function LinkExercise({
  device,
  placeId,
  onLinked,
  onCreate,
}: {
  device: DeviceWithExercises;
  placeId: string;
  onLinked: () => void;
  onCreate: () => void;
}) {
  const [query, setQuery] = useState('');
  const search = useExerciseSearch(query);
  const link = useLinkExercise(placeId);
  const linked = new Set(device.exercises.map((exercise) => exercise.id));
  const results = (search.data ?? []).filter((exercise) => !linked.has(exercise.id));

  return (
    <div className="flex flex-col gap-3">
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
                  { deviceId: device.id, exerciseId: exercise.id },
                  { onSuccess: onLinked },
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

function NewDeviceForm({
  placeId,
  onCreated,
}: {
  placeId: string;
  onCreated: (device: Device) => void;
}) {
  const create = useCreateEmptyDevice(placeId);
  const [name, setName] = useState('');
  const [step, setStep] = useState('2,5');
  const [comparable, setComparable] = useState(false);
  const stepValue = step.trim() === '' ? null : Number(step.replace(',', '.'));

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate({ name, weightStep: stepValue, comparable }, { onSuccess: onCreated });
      }}
    >
      <TextField
        label="Name des Geräts"
        placeholder="z. B. Kabelturm"
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
      <Button type="submit" disabled={name.trim().length < 2} loading={create.isPending}>
        Anlegen und Übungen zuordnen
      </Button>
    </form>
  );
}

function NewExerciseForDevice({
  placeId,
  deviceId,
  initialName,
  onCancel,
  onCreated,
}: {
  placeId: string | null;
  deviceId: string | null;
  initialName: string;
  onCancel: () => void;
  onCreated: (exercise: ExerciseSummary) => void;
}) {
  const link = useLinkExercise(placeId ?? '');
  return (
    <CreateExerciseForm
      initialName={initialName}
      onCancel={onCancel}
      onCreated={(exercise) => {
        if (deviceId) {
          link.mutate(
            { deviceId, exerciseId: exercise.id },
            {
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
  onPick,
  onCreate,
}: {
  query: string;
  onPick: (exercise: ExerciseSummary) => void;
  onCreate: () => void;
}) {
  const search = useExerciseSearch(query);
  const overview = useExerciseOverview().data;
  const results = search.data ?? [];
  const muscles = usePrimaryMuscles(results.map((exercise) => exercise.id));
  // Most recently done first (in the shared scope), then alphabetical.
  const sorted = [...results].sort((a, b) => {
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
          return (
            <Tile
              key={exercise.id}
              title={exercise.name}
              subtitle={
                history
                  ? lastDoneText(history, exercise)
                  : (muscles.get(exercise.id)?.join(' · ') ?? measureLabel[exercise.measure])
              }
              trend={history?.trend}
              onClick={() => {
                onPick(exercise);
              }}
            />
          );
        })}
      </div>
      {!search.isPending && results.length === 0 && query.trim().length < 2 && (
        <p className="text-subhead text-text-muted">
          Noch keine Übungen im Katalog. Leg die erste an.
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

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------
function lastDoneText(history: ExerciseHistory, exercise: ExerciseSummary): string {
  const set = {
    weightKg: history.lastWeightKg,
    reps: history.lastReps,
    durationSeconds: history.lastDurationSeconds,
  };
  return `${formatRelativeTime(history.lastDoneAt)} · ${formatSet(exercise.measure, set)}`;
}

/** Tile with image area (placeholder until illustrations exist), title, subtitle, trend. */
function Tile({
  title,
  subtitle,
  trend,
  onClick,
  onInfo,
}: {
  title: string;
  subtitle: string;
  trend?: ExerciseHistory['trend'] | undefined;
  onClick: () => void;
  onInfo?: () => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        className="flex w-full flex-col overflow-hidden rounded-card border border-border bg-surface-2 text-left active:bg-surface-3"
      >
        <span
          aria-hidden
          className="flex aspect-[4/3] items-center justify-center image-backdrop text-large-title font-bold text-accent/70"
        >
          {title.charAt(0).toUpperCase()}
        </span>
        <span className="flex flex-col gap-1 p-3">
          <span className="line-clamp-2 text-subhead font-semibold">{title}</span>
          <span className="truncate text-caption text-text-muted">{subtitle}</span>
          {trend && trend.length >= 2 && <Sparkline points={trend} />}
        </span>
      </button>
      {onInfo && (
        <button
          type="button"
          aria-label={`${title}: Details`}
          onClick={onInfo}
          className="absolute top-1.5 right-1.5 flex size-tap items-center justify-center rounded-pill glass text-footnote font-bold"
        >
          i
        </button>
      )}
    </div>
  );
}
