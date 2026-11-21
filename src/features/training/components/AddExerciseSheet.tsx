import { useState } from 'react';
import { cn } from '@/shared/lib';
import { Button, Chip, SegmentedControl, Sheet, TextField } from '@/shared/ui';
import {
  useCreateExercise,
  useExerciseSearch,
  useMuscleGroups,
  usePrimaryMuscles,
} from '../api/useCatalog';
import type { Device, DeviceWithExercises, ExerciseMeasure, ExerciseSummary } from '../types';

export interface AddExerciseSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  /** Devices at the current place; shown first and attached when picking. */
  devices?: DeviceWithExercises[] | undefined;
  onPick: (exercise: ExerciseSummary, device: Device | null) => void;
}

const measures: { value: ExerciseMeasure; label: string }[] = [
  { value: 'weight_reps', label: 'Gewicht × Wdh.' },
  { value: 'reps', label: 'Wiederholungen' },
  { value: 'duration', label: 'Dauer' },
];

const measureLabel: Record<ExerciseMeasure, string> = {
  weight_reps: 'Gewicht × Wdh.',
  reps: 'Wiederholungen',
  duration: 'Dauer',
};

/**
 * Search first, create only if nothing fits (duplicate protection). New exercises get
 * their measure and, optionally, muscle groups right away.
 */
export function AddExerciseSheet({
  open,
  onOpenChange,
  title = 'Übung hinzufügen',
  devices = [],
  onPick,
}: AddExerciseSheetProps) {
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const search = useExerciseSearch(query);
  const results = search.data ?? [];
  // An exercise found by search uses this place's device if exactly one offers it.
  const deviceFor = (exerciseId: string): Device | null => {
    const offering = devices.filter((device) =>
      device.exercises.some((exercise) => exercise.id === exerciseId),
    );
    return offering.length === 1 ? (offering[0] ?? null) : null;
  };
  const deviceTiles = devices.flatMap((device) =>
    device.exercises.map((exercise) => ({ exercise, device })),
  );
  const showDevices = query.trim().length === 0 && deviceTiles.length > 0;
  const shownIds = [
    ...results.map((exercise) => exercise.id),
    ...(showDevices ? deviceTiles.map((tile) => tile.exercise.id) : []),
  ];
  const muscles = usePrimaryMuscles(shownIds);
  const exactMatch = results.some(
    (exercise) => exercise.name.toLowerCase() === query.trim().toLowerCase(),
  );

  function close() {
    setQuery('');
    setCreating(false);
    onOpenChange(false);
  }

  function pick(exercise: ExerciseSummary, device: Device | null) {
    onPick(exercise, device);
    close();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      title={title}
      className="min-h-sheet-min"
    >
      {creating ? (
        <CreateExerciseForm
          initialName={query}
          onCancel={() => {
            setCreating(false);
          }}
          onCreated={(exercise) => {
            pick(exercise, null);
          }}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <TextField
            label="Übung suchen"
            placeholder="z. B. Bankdrücken"
            value={query}
            autoCorrect="off"
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />
          {showDevices && (
            <section className="flex flex-col gap-2">
              <h3 className="text-footnote font-medium text-text-muted">An den Geräten hier</h3>
              <div className="grid grid-cols-2 gap-2">
                {deviceTiles.map(({ exercise, device }) => (
                  <ExerciseTile
                    key={`${device.id}:${exercise.id}`}
                    exercise={exercise}
                    subtitle={device.name === exercise.name ? undefined : device.name}
                    muscles={muscles.get(exercise.id)}
                    onClick={() => {
                      pick(exercise, device);
                    }}
                  />
                ))}
              </div>
            </section>
          )}
          {results.length > 0 && (
            <section className="flex flex-col gap-2">
              {showDevices && (
                <h3 className="text-footnote font-medium text-text-muted">Alle Übungen</h3>
              )}
              <div className="grid grid-cols-2 gap-2">
                {results.map((exercise) => (
                  <ExerciseTile
                    key={exercise.id}
                    exercise={exercise}
                    subtitle={exercise.matchedAlias ? `auch: ${exercise.matchedAlias}` : undefined}
                    muscles={muscles.get(exercise.id)}
                    onClick={() => {
                      pick(exercise, deviceFor(exercise.id));
                    }}
                  />
                ))}
              </div>
            </section>
          )}
          {!search.isPending && results.length === 0 && query.trim().length < 2 && (
            <p className="text-subhead text-text-muted">
              Noch keine Übungen im Katalog. Leg die erste an – der Katalog wächst mit dem, was ihr
              wirklich trainiert.
            </p>
          )}
          {query.trim().length >= 2 && !exactMatch && (
            <Button
              variant="secondary"
              onClick={() => {
                setCreating(true);
              }}
            >
              „{query.trim()}“ neu anlegen
            </Button>
          )}
        </div>
      )}
    </Sheet>
  );
}

/** Tile with an image area (placeholder until illustrations exist), name and muscles. */
function ExerciseTile({
  exercise,
  subtitle,
  muscles,
  onClick,
}: {
  exercise: ExerciseSummary;
  subtitle?: string | undefined;
  muscles?: string[] | undefined;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col overflow-hidden rounded-card border border-border bg-surface-2 text-left active:bg-surface-3"
    >
      <span
        aria-hidden
        className="flex aspect-[4/3] items-center justify-center image-backdrop text-large-title font-bold text-accent/70"
      >
        {exercise.name.charAt(0).toUpperCase()}
      </span>
      <span className="flex flex-col gap-0.5 p-3">
        <span className="line-clamp-2 text-subhead font-semibold">{exercise.name}</span>
        <span className="truncate text-caption text-text-muted">
          {muscles && muscles.length > 0 ? muscles.join(' · ') : measureLabel[exercise.measure]}
        </span>
        {subtitle && <span className="truncate text-caption text-text-subtle">{subtitle}</span>}
      </span>
    </button>
  );
}

function CreateExerciseForm({
  initialName,
  onCancel,
  onCreated,
}: {
  initialName: string;
  onCancel: () => void;
  onCreated: (exercise: ExerciseSummary) => void;
}) {
  const [name, setName] = useState(initialName.trim());
  const [measure, setMeasure] = useState<ExerciseMeasure>('weight_reps');
  const [primary, setPrimary] = useState<string[]>([]);
  const [secondary, setSecondary] = useState<string[]>([]);
  const muscles = useMuscleGroups();
  const create = useCreateExercise();
  const duplicate =
    create.error && 'code' in create.error && create.error.code === '23505'
      ? 'Diese Übung gibt es schon – such sie in der Liste.'
      : null;

  // Tap cycles a muscle: off → main → involved → off.
  function cycle(key: string) {
    if (primary.includes(key)) {
      setPrimary(primary.filter((k) => k !== key));
      setSecondary([...secondary, key]);
    } else if (secondary.includes(key)) {
      setSecondary(secondary.filter((k) => k !== key));
    } else {
      setPrimary([...primary, key]);
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate(
          { name, measure, primaryMuscles: primary, secondaryMuscles: secondary },
          { onSuccess: onCreated },
        );
      }}
    >
      <TextField
        label="Name"
        value={name}
        maxLength={60}
        onChange={(event) => {
          setName(event.target.value);
        }}
        error={duplicate}
      />
      <div className="flex flex-col gap-2">
        <span className="text-footnote font-medium text-text-muted">Erfassung</span>
        <SegmentedControl
          label="Erfassung"
          value={measure}
          options={measures}
          onChange={setMeasure}
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-footnote font-medium text-text-muted">
          Muskelgruppen (optional) – 1× tippen: Haupt, 2×: mitbeteiligt
        </span>
        <div className="flex flex-wrap gap-2">
          {(muscles.data ?? []).map((muscle) => (
            <Chip
              key={muscle.key}
              selected={primary.includes(muscle.key)}
              className={cn(secondary.includes(muscle.key) && 'border-accent text-accent')}
              onClick={() => {
                cycle(muscle.key);
              }}
            >
              {muscle.label}
            </Chip>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={name.trim().length < 2} loading={create.isPending}>
          Anlegen
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Zurück
        </Button>
      </div>
    </form>
  );
}
