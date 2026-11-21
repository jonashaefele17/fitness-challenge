import { animate, motion, useDragControls, useMotionValue, type PanInfo } from 'motion/react';
import { pressScale, spring } from '@/shared/design-tokens';
import { cn, hapticTick, showToast } from '@/shared/lib';
import { Card } from '@/shared/ui';
import { formatSettingValues, useDeviceSetting } from '../api/usePlaces';
import {
  useAddSet,
  useDeleteSet,
  useExerciseTrend,
  usePreviousSets,
  useUpdateSet,
  type SetChanges,
} from '../api/useWorkout';
import { formatDuration, formatKg, formatSet } from '../format';
import type { ExerciseMeasure, PreviousSet, WorkoutItem, WorkoutSet } from '../types';
import { NumberWheel } from './NumberWheel';
import { Sparkline } from './Sparkline';

const STEP = { weight: 2.5, reps: 1, duration: 5 } as const;
/** Width of the revealed delete button. */
const DELETE_ACTION_PX = 88;

export interface ExerciseCardProps {
  item: WorkoutItem;
  onMenu: () => void;
  /** Open device details (setting, weight steps). */
  onDevice: () => void;
}

export function ExerciseCard({ item, onMenu, onDevice }: ExerciseCardProps) {
  const deviceId = item.device?.id ?? null;
  const previous = usePreviousSets(item.exercise.id, deviceId).data ?? [];
  const trend = useExerciseTrend(item.exercise.id, deviceId).data ?? [];
  const settingValues = useDeviceSetting(deviceId, item.exercise.id).data ?? {};
  const fields = item.device?.settingFields ?? [];
  const settingText = formatSettingValues(fields, settingValues);
  const otherDevice = previous.length > 0 && previous.every((set) => !set.sameDevice);
  const weightStep = item.device?.weightStep ?? STEP.weight;
  const addSet = useAddSet();
  const measure = item.exercise.measure;
  const activeId = item.sets.find((set) => set.completedAt === null)?.id ?? null;
  let workingIndex = 0;

  function newSet() {
    const last = item.sets[item.sets.length - 1];
    const prev = previous[item.sets.length];
    addSet.mutate({
      itemId: item.id,
      set: {
        id: crypto.randomUUID(),
        position: (last?.position ?? -1) + 1,
        weightKg: last?.weightKg ?? prev?.weightKg ?? null,
        reps: last?.reps ?? prev?.reps ?? null,
        durationSeconds: last?.durationSeconds ?? prev?.durationSeconds ?? null,
        isWarmup: false,
        completedAt: null,
      },
    });
  }

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex items-start justify-between gap-3 p-4 pb-2">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-title-3 font-semibold">{item.exercise.name}</h2>
          {item.device && (
            <button
              type="button"
              onClick={onDevice}
              className="-ml-1 self-start rounded-sm px-1 text-left text-footnote text-text-muted active:bg-surface-2"
            >
              {item.device.name}
              {fields.length === 0
                ? ''
                : settingText
                  ? ` · ${settingText}`
                  : ' · Einstellungen eintragen'}
            </button>
          )}
          <Sparkline points={trend} />
          {item.note && <p className="text-footnote text-text-muted">{item.note}</p>}
        </div>
        <button
          type="button"
          aria-label="Übungsoptionen"
          onClick={onMenu}
          className="-mt-1 -mr-2 flex size-tap shrink-0 items-center justify-center rounded-pill text-title-3 text-text-muted active:bg-surface-2"
        >
          …
        </button>
      </div>

      <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto_2.75rem] items-center gap-x-2 px-4 pb-1 text-caption font-medium text-text-subtle">
        <span>Satz</span>
        <span>{otherDevice ? 'Vorher (anderes Gerät)' : 'Vorher'}</span>
        <span className="text-center">{measure === 'duration' ? 'Zeit' : 'Neu'}</span>
        <span />
      </div>

      <ul>
        {item.sets.map((set) => {
          const label = set.isWarmup ? 'W' : String(++workingIndex);
          return (
            <SetRow
              key={set.id}
              itemId={item.id}
              set={set}
              label={label}
              measure={measure}
              active={set.id === activeId}
              previous={previous[set.position] ?? previous[previous.length - 1]}
              fallback={item.sets.filter((other) => other.completedAt !== null).at(-1)}
              weightStep={weightStep}
            />
          );
        })}
      </ul>

      <button
        type="button"
        onClick={newSet}
        className="min-h-tap w-full border-t border-border text-subhead font-semibold text-accent active:bg-surface-2"
      >
        + Satz
      </button>
    </Card>
  );
}

function SetRow({
  itemId,
  set,
  label,
  measure,
  active,
  previous,
  fallback,
  weightStep,
}: {
  itemId: string;
  set: WorkoutSet;
  label: string;
  measure: ExerciseMeasure;
  active: boolean;
  previous: PreviousSet | undefined;
  fallback: WorkoutSet | undefined;
  weightStep: number;
}) {
  const update = useUpdateSet();
  const remove = useDeleteSet();
  const addSet = useAddSet();
  const done = set.completedAt !== null;
  const dragControls = useDragControls();
  const x = useMotionValue(0);

  // Suggested values for an empty active row: last ticked set, else last workout.
  const suggestion = {
    weightKg: set.weightKg ?? fallback?.weightKg ?? previous?.weightKg ?? null,
    reps: set.reps ?? fallback?.reps ?? previous?.reps ?? null,
    durationSeconds:
      set.durationSeconds ?? fallback?.durationSeconds ?? previous?.durationSeconds ?? null,
  };

  const change = (changes: SetChanges) => {
    update.mutate({ itemId, setId: set.id, changes });
  };

  function toggleDone() {
    if (done) {
      change({ completedAt: null });
      return;
    }
    hapticTick();
    change({ ...suggestion, completedAt: new Date().toISOString() });
  }

  function deleteSet() {
    hapticTick();
    remove.mutate({ itemId, setId: set.id });
    showToast('Satz gelöscht', {
      label: 'Rückgängig',
      onAction: () => {
        addSet.mutate({ itemId, set });
      },
    });
  }

  // The row follows the finger and snaps open to reveal the delete button (no full-swipe
  // delete: deleting always needs the explicit tap on the button).
  function handleDragEnd(_: unknown, info: PanInfo) {
    const open = x.get() < -DELETE_ACTION_PX / 3 || info.velocity.x < -300;
    void animate(x, open ? -DELETE_ACTION_PX : 0, spring.snappy);
  }

  return (
    <li className="relative overflow-hidden">
      <div className="absolute inset-0 flex justify-end bg-danger">
        <button
          type="button"
          onClick={deleteSet}
          className="flex w-22 items-center justify-center text-subhead font-semibold text-text"
        >
          Löschen
        </button>
      </div>
      <motion.div
        style={{ x }}
        drag="x"
        dragListener={false}
        dragControls={dragControls}
        onPointerDown={(event) => {
          // Swipe-to-delete starts anywhere on the row except on the number wheels.
          if ((event.target as Element).closest('[data-wheel]')) return;
          dragControls.start(event);
        }}
        onClickCapture={(event) => {
          // A tap on an opened row closes it instead of triggering its buttons.
          if (x.get() < -4) {
            event.stopPropagation();
            void animate(x, 0, spring.snappy);
          }
        }}
        dragDirectionLock
        dragMomentum={false}
        dragElastic={false}
        dragConstraints={{ left: -DELETE_ACTION_PX, right: 0 }}
        onDragEnd={handleDragEnd}
        className={cn(
          // pan-y: the browser may only scroll vertically here; sideways moves belong to the row.
          'relative grid min-h-tap touch-pan-y grid-cols-[2.25rem_minmax(0,1fr)_auto_2.75rem] items-center gap-x-2 bg-surface px-4 py-1',
          active && 'bg-surface-2',
        )}
      >
        <button
          type="button"
          aria-label={
            set.isWarmup
              ? 'Aufwärmsatz – tippen für Arbeitssatz'
              : 'Arbeitssatz – tippen für Aufwärmsatz'
          }
          onClick={() => {
            change({ isWarmup: !set.isWarmup });
          }}
          className={cn(
            'flex size-9 items-center justify-center rounded-pill text-subhead font-semibold',
            set.isWarmup ? 'bg-warning/20 text-warning' : 'text-text-muted',
          )}
        >
          {label}
        </button>
        <span className="truncate text-subhead text-text-subtle">
          {previous ? formatSet(measure, previous) : '–'}
        </span>
        <span className="justify-self-center">
          {active ? (
            <ActiveInputs
              measure={measure}
              values={suggestion}
              filled={set}
              weightStep={weightStep}
              onChange={change}
            />
          ) : (
            <span className={cn('text-body tabular-nums', !done && 'text-text-subtle')}>
              {formatSet(measure, set)}
            </span>
          )}
        </span>
        <motion.button
          type="button"
          aria-label={done ? 'Satz zurücksetzen' : 'Satz bestätigen'}
          aria-pressed={done}
          whileTap={{ scale: pressScale }}
          transition={spring.press}
          onClick={toggleDone}
          className={cn(
            'flex size-tap items-center justify-center rounded-pill border-2 text-title-3',
            done ? 'border-accent bg-accent text-on-accent' : 'border-surface-3 text-transparent',
          )}
        >
          ✓
        </motion.button>
      </motion.div>
    </li>
  );
}

function ActiveInputs({
  measure,
  values,
  filled,
  weightStep,
  onChange,
}: {
  measure: ExerciseMeasure;
  weightStep: number;
  values: Pick<WorkoutSet, 'weightKg' | 'reps' | 'durationSeconds'>;
  filled: Pick<WorkoutSet, 'weightKg' | 'reps' | 'durationSeconds'>;
  onChange: (changes: SetChanges) => void;
}) {
  if (measure === 'duration') {
    return (
      <NumberWheel
        value={values.durationSeconds}
        suggested={filled.durationSeconds === null}
        step={STEP.duration}
        format={(v) => formatDuration(v)}
        parse={parseDuration}
        label="Dauer"
        onChange={(durationSeconds) => {
          onChange({ durationSeconds });
        }}
      />
    );
  }
  return (
    <span className="flex items-center gap-1">
      {(measure === 'weight_reps' || values.weightKg !== null) && (
        <NumberWheel
          value={values.weightKg}
          suggested={filled.weightKg === null}
          step={weightStep}
          format={(v) => formatKg(v)}
          parse={(text) => Number(text.replace(',', '.'))}
          label={measure === 'reps' ? 'Zusatzgewicht' : 'Gewicht'}
          onChange={(weightKg) => {
            onChange({ weightKg });
          }}
        />
      )}
      <span className="text-subhead text-text-subtle">×</span>
      <NumberWheel
        value={values.reps}
        suggested={filled.reps === null}
        step={STEP.reps}
        format={(v) => String(v)}
        parse={(text) => Number.parseInt(text, 10)}
        label="Wiederholungen"
        onChange={(reps) => {
          onChange({ reps });
        }}
      />
    </span>
  );
}

function parseDuration(text: string): number {
  const [m, s] = text.split(':');
  return s === undefined ? Number(m) : Number(m) * 60 + Number(s);
}
