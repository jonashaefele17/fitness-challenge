import { motion, type PanInfo } from 'motion/react';
import { useState } from 'react';
import { pressScale, spring } from '@/shared/design-tokens';
import { cn, showToast } from '@/shared/lib';
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
import { Sparkline } from './Sparkline';

const STEP = { weight: 2.5, reps: 1, duration: 5 } as const;
const SWIPE_DELETE_PX = 90;

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

      <div className="grid grid-cols-[2.5rem_1fr_auto_2.75rem] items-center gap-x-2 px-4 pb-1 text-caption font-medium text-text-subtle">
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
    change({ ...suggestion, completedAt: new Date().toISOString() });
  }

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x > -SWIPE_DELETE_PX) return;
    remove.mutate({ itemId, setId: set.id });
    showToast('Satz gelöscht', {
      label: 'Rückgängig',
      onAction: () => {
        addSet.mutate({ itemId, set });
      },
    });
  }

  return (
    <li className="relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 flex items-center justify-end bg-danger px-5 text-subhead font-semibold text-text"
      >
        Löschen
      </div>
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.6, right: 0 }}
        onDragEnd={handleDragEnd}
        className={cn(
          'relative grid min-h-tap grid-cols-[2.5rem_1fr_auto_2.75rem] items-center gap-x-2 bg-surface px-4 py-1',
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
      <Stepper
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
        <Stepper
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
      <Stepper
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

/** ‹ value ›: arrows step in fixed increments, tapping the value allows typing. */
function Stepper({
  value,
  suggested,
  step,
  format,
  parse,
  label,
  onChange,
}: {
  value: number | null;
  suggested: boolean;
  step: number;
  format: (value: number) => string;
  parse: (text: string) => number;
  label: string;
  onChange: (value: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const current = value ?? 0;
  const nudge = (delta: number) => {
    onChange(Math.max(0, Math.round((current + delta) * 100) / 100));
  };

  return (
    <span className="flex items-center">
      <button
        type="button"
        aria-label={`${label} verringern`}
        onClick={() => {
          nudge(-step);
        }}
        className="flex h-tap w-7 items-center justify-center text-title-3 text-text-muted"
      >
        ‹
      </button>
      {editing ? (
        <input
          autoFocus
          aria-label={label}
          inputMode="decimal"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onBlur={() => {
            const parsed = parse(draft);
            if (Number.isFinite(parsed) && parsed >= 0) onChange(parsed);
            setEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          className="w-14 rounded-sm bg-surface-3 py-1 text-center text-body tabular-nums focus:outline-none"
        />
      ) : (
        <button
          type="button"
          aria-label={`${label}: ${value === null ? 'leer' : format(value)}`}
          onClick={() => {
            setDraft(value === null ? '' : format(value));
            setEditing(true);
          }}
          className={cn(
            'min-w-12 rounded-sm py-1 text-center text-body font-semibold tabular-nums',
            suggested && 'text-text-muted',
          )}
        >
          {value === null ? '–' : format(value)}
        </button>
      )}
      <button
        type="button"
        aria-label={`${label} erhöhen`}
        onClick={() => {
          nudge(step);
        }}
        className="flex h-tap w-7 items-center justify-center text-title-3 text-text-muted"
      >
        ›
      </button>
    </span>
  );
}
