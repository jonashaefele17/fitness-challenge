import {
  closestCenter,
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { fade } from '@/shared/design-tokens';
import { cn, showToast } from '@/shared/lib';
import { Button, Card, Chip, ChevronDownIcon, Sheet, TextField } from '@/shared/ui';
import {
  useAddExercise,
  useDeleteWorkout,
  useDiscardWorkout,
  useFinishWorkout,
  useRemoveItem,
  useReorderItems,
  useRestoreItem,
  useSwapExercise,
  useTogglePause,
  useSetItemDevice,
  useSetWorkoutFocus,
  useSetWorkoutLocation,
  useUpdateItemNote,
  useUpdateWorkoutTime,
  useWorkoutRecords,
  type FinishedWorkout,
} from '../api/useWorkout';
import {
  elapsedSeconds,
  formatDuration,
  formatKg,
  formatSet,
  summarize,
  type WorkoutSummary,
} from '../format';
import type { ActiveWorkout, Device, ExerciseSummary, WorkoutItem } from '../types';
import { ExercisePickerSheet } from './ExercisePickerSheet';
import { DevicePickerSheet } from './DevicePickerSheet';
import { DeviceSheet } from './DeviceSheet';
import { PlacePicker } from './PlacePicker';
import { ExerciseCard } from './ExerciseCard';
import { RememberDevices } from './RememberDevices';
import { RoutinePlayer } from './routine/RoutinePlayer';
import { parseWhen, whenFrom, type When } from './when';
import { WhenFields } from './WhenFields';
import { SaveAsTemplate } from './templates/SaveAsTemplate';
import { ExerciseHistorySheet, type HistoryTarget } from './history/ExerciseHistorySheet';

export interface WorkoutScreenProps {
  workout: ActiveWorkout;
  /** live: the running workout. edit: one of my finished workouts (also when added afterwards). */
  mode?: 'live' | 'edit';
  /** Leave the screen; the workout keeps running (mini bar). */
  onMinimize: () => void;
  /** After finishing and closing the summary, or after discarding. */
  onClose: () => void;
}

type Menu = { kind: 'workout' } | { kind: 'item'; item: WorkoutItem } | null;

export function WorkoutScreen({ workout, mode = 'live', onMinimize, onClose }: WorkoutScreenProps) {
  const editing = mode === 'edit';
  const [timeOpen, setTimeOpen] = useState(false);
  const deleteWorkout = useDeleteWorkout();
  const [activeId, setActiveId] = useState<string | null>(workout.items[0]?.id ?? null);
  const [menu, setMenu] = useState<Menu>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [swapItem, setSwapItem] = useState<WorkoutItem | null>(null);
  const [noteItem, setNoteItem] = useState<WorkoutItem | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [pickDeviceFor, setPickDeviceFor] = useState<WorkoutItem | null>(null);
  const [historyTarget, setHistoryTarget] = useState<HistoryTarget | null>(null);
  const [deviceTarget, setDeviceTarget] = useState<{
    device: Device;
    exercise: ExerciseSummary;
  } | null>(null);
  const setItemDevice = useSetItemDevice();
  const setLocation = useSetWorkoutLocation(workout.id);
  const setFocus = useSetWorkoutFocus(workout.id);
  const [summary, setSummary] = useState<
    | (WorkoutSummary &
        FinishedWorkout & {
          exerciseIds: string[];
          exerciseList: ExerciseSummary[];
          location: ActiveWorkout['location'];
          deviceless: Pick<WorkoutItem, 'id' | 'exercise'>[];
          templateId: string | null;
          trainingTypeId: string;
          focusId: string | null;
        })
    | null
  >(null);

  const addExercise = useAddExercise(workout.id);
  const reorder = useReorderItems();
  const removeItem = useRemoveItem();
  const restoreItem = useRestoreItem(workout.id);
  const swap = useSwapExercise();
  const pause = useTogglePause();
  const finish = useFinishWorkout();
  const discard = useDiscardWorkout();

  const items = workout.items;
  const index = Math.max(
    0,
    items.findIndex((item) => item.id === activeId),
  );
  const active = items[index] ?? null;

  // A removed selection falls back to the first exercise (index -1 → 0 above).

  function remove(item: WorkoutItem) {
    removeItem.mutate(item.id);
    showToast(`${item.exercise.name} entfernt`, {
      label: 'Rückgängig',
      onAction: () => {
        restoreItem.mutate({ item, items });
      },
    });
  }

  function finishWorkout() {
    const stats = summarize(items);
    finish.mutate(workout.id, {
      onSuccess: (finished) => {
        setSummary({
          ...stats,
          ...finished,
          // Snapshot for "save as template" (the running workout goes away now).
          exerciseIds: items
            .filter((item) => item.sets.some((set) => set.completedAt !== null))
            .map((item) => item.exercise.id),
          exerciseList: items.map((item) => item.exercise),
          location: workout.location,
          deviceless: items
            .filter((item) => !item.device && item.sets.some((set) => set.completedAt !== null))
            .map((item) => ({ id: item.id, exercise: item.exercise })),
          templateId: workout.templateId,
          trainingTypeId: workout.trainingType.id,
          focusId: workout.focusId,
        });
      },
    });
  }

  return (
    // Fixed frame: header, chips and the bottom bar never move; only the exercise scrolls.
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-bg pt-safe pb-safe">
      {/* Equal-width side buttons keep the title exactly centred. */}
      <header className="grid shrink-0 grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 px-gutter pt-3 pb-2">
        <button
          type="button"
          aria-label={editing ? 'Schließen' : 'Minimieren'}
          onClick={editing ? onClose : onMinimize}
          className="flex size-tap items-center justify-center rounded-pill text-title-2 text-accent active:bg-surface-2"
        >
          <ChevronDownIcon />
        </button>
        <div className="flex min-w-0 flex-col items-center text-center">
          <span className="max-w-full truncate text-footnote text-text-muted">
            {workout.trainingType.name}
            {workout.location ? ` · ${workout.location.name}` : ''}
          </span>
          {editing ? (
            <button
              type="button"
              onClick={() => {
                setTimeOpen(true);
              }}
              className="text-subhead font-semibold text-accent"
            >
              {editDate.format(new Date(workout.startedAt))} ·{' '}
              {formatMinutesShort(workoutSeconds(workout))}
            </button>
          ) : (
            <ElapsedTime workout={workout} />
          )}
        </div>
        <button
          type="button"
          aria-label="Trainingsmenü"
          onClick={() => {
            setMenu({ kind: 'workout' });
          }}
          className="flex size-tap items-center justify-center rounded-pill text-title-3 text-text-muted active:bg-surface-2"
        >
          …
        </button>
      </header>

      {/* Guided routines (Mobility): the phone leads instead of a set list. */}
      {workout.trainingType.guided && !editing ? (
        <RoutinePlayer
          workoutId={workout.id}
          trainingTypeId={workout.trainingType.id}
          items={items}
          onFinish={finishWorkout}
          finishing={finish.isPending}
        />
      ) : (
        <>
          {items.length > 0 && (
            <ExerciseChips
              items={items}
              activeId={active?.id ?? null}
              onSelect={setActiveId}
              onReorder={(next) => {
                reorder.mutate(next);
              }}
            />
          )}

          <main className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-gutter pt-3 pb-4">
            <AnimatePresence mode="wait" initial={false}>
              {active ? (
                <motion.div
                  key={active.id}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={fade.fast}
                >
                  <ExerciseCard
                    item={active}
                    onDevice={() => {
                      if (active.device)
                        setDeviceTarget({ device: active.device, exercise: active.exercise });
                    }}
                    onMenu={() => {
                      setMenu({ kind: 'item', item: active });
                    }}
                    onHistory={() => {
                      setHistoryTarget({ exercise: active.exercise, device: active.device });
                    }}
                  />
                </motion.div>
              ) : (
                <Card className="flex flex-col items-start gap-3">
                  <p className="text-subhead text-text-muted">
                    Füg deine erste Übung hinzu. Sätze werden beim Abhaken sofort gespeichert.
                  </p>
                  <Button
                    onClick={() => {
                      setAddOpen(true);
                    }}
                  >
                    Übung hinzufügen
                  </Button>
                </Card>
              )}
            </AnimatePresence>
          </main>

          {items.length > 0 && (
            <nav className="mx-gutter mb-3 flex shrink-0 items-center justify-between rounded-pill glass p-1">
              <Button
                variant="ghost"
                aria-label="Vorherige Übung"
                disabled={index === 0}
                onClick={() => {
                  setActiveId(items[index - 1]?.id ?? null);
                }}
              >
                ‹
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setAddOpen(true);
                }}
              >
                + Übung
              </Button>
              {index < items.length - 1 ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setActiveId(items[index + 1]?.id ?? null);
                  }}
                >
                  Nächste ›
                </Button>
              ) : editing ? (
                <Button onClick={onClose}>Fertig ✓</Button>
              ) : (
                // Last exercise: the same spot finishes the workout.
                <Button loading={finish.isPending} onClick={finishWorkout}>
                  Beenden ✓
                </Button>
              )}
            </nav>
          )}
        </>
      )}

      <ExercisePickerSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        place={workout.location}
        catalog={workout.trainingType.catalog}
        allowedFocusIds={workout.trainingType.focusIds}
        focusId={workout.focusId}
        onFocusChange={(focusId) => {
          setFocus.mutate(focusId);
        }}
        onPick={(exercise, device) => {
          const itemId = crypto.randomUUID();
          addExercise.mutate({
            itemId,
            setId: crypto.randomUUID(),
            exercise,
            device,
            afterItemId: active?.id ?? null,
            items,
          });
          setActiveId(itemId);
        }}
      />
      <ExercisePickerSheet
        open={swapItem !== null}
        onOpenChange={(open) => {
          if (!open) setSwapItem(null);
        }}
        title="Übung tauschen"
        place={workout.location}
        catalog={workout.trainingType.catalog}
        allowedFocusIds={workout.trainingType.focusIds}
        focusId={workout.focusId}
        onFocusChange={(focusId) => {
          setFocus.mutate(focusId);
        }}
        onPick={(exercise, device) => {
          if (!swapItem) return;
          swap.mutate({ itemId: swapItem.id, exercise });
          setItemDevice.mutate({ itemId: swapItem.id, device });
        }}
      />
      <ExerciseHistorySheet
        target={historyTarget}
        onClose={() => {
          setHistoryTarget(null);
        }}
      />
      <DevicePickerSheet
        item={pickDeviceFor}
        place={workout.location}
        onClose={() => {
          setPickDeviceFor(null);
        }}
      />
      <DeviceSheet
        target={deviceTarget}
        onClose={() => {
          setDeviceTarget(null);
        }}
      />
      <Sheet open={placeOpen} onOpenChange={setPlaceOpen} title="Wo trainierst du?">
        <PlacePicker
          allowNone
          currentId={workout.location?.id ?? null}
          onPick={(place) => {
            setLocation.mutate(place);
            setPlaceOpen(false);
          }}
        />
      </Sheet>
      <NoteSheet
        item={noteItem}
        onClose={() => {
          setNoteItem(null);
        }}
      />

      <Sheet
        open={menu !== null}
        onOpenChange={(open) => {
          if (!open) setMenu(null);
        }}
        title={menu?.kind === 'item' ? menu.item.exercise.name : 'Training'}
      >
        <div className="flex flex-col gap-2">
          {menu?.kind === 'item' ? (
            <>
              {menu.item.device && (
                <MenuButton
                  label="Gerät & Einstellungen"
                  onClick={() => {
                    if (menu.item.device) {
                      setDeviceTarget({ device: menu.item.device, exercise: menu.item.exercise });
                    }
                    setMenu(null);
                  }}
                />
              )}
              <MenuButton
                label={menu.item.device ? 'Anderes Gerät wählen' : 'Gerät wählen'}
                onClick={() => {
                  setPickDeviceFor(menu.item);
                  setMenu(null);
                }}
              />
              <MenuButton
                label="Verlauf"
                onClick={() => {
                  setHistoryTarget({ exercise: menu.item.exercise, device: menu.item.device });
                  setMenu(null);
                }}
              />
              <MenuButton
                label="Übung tauschen"
                onClick={() => {
                  setSwapItem(menu.item);
                  setMenu(null);
                }}
              />
              <MenuButton
                label={menu.item.note ? 'Notiz bearbeiten' : 'Notiz hinzufügen'}
                onClick={() => {
                  setNoteItem(menu.item);
                  setMenu(null);
                }}
              />
              <MenuButton
                label="Übung entfernen"
                danger
                onClick={() => {
                  remove(menu.item);
                  setMenu(null);
                }}
              />
            </>
          ) : editing ? (
            <>
              <MenuButton
                label="Tag, Uhrzeit & Dauer"
                onClick={() => {
                  setMenu(null);
                  setTimeOpen(true);
                }}
              />
              <MenuButton
                label="Ort ändern"
                onClick={() => {
                  setMenu(null);
                  setPlaceOpen(true);
                }}
              />
              <MenuButton
                label="Training löschen"
                danger
                onClick={() => {
                  setMenu(null);
                  setConfirmDiscard(true);
                }}
              />
            </>
          ) : (
            <>
              <MenuButton
                label={workout.pausedAt ? 'Fortsetzen' : 'Pausieren'}
                onClick={() => {
                  pause.mutate(workout);
                  setMenu(null);
                }}
              />
              <MenuButton
                label="Ort ändern"
                onClick={() => {
                  setMenu(null);
                  setPlaceOpen(true);
                }}
              />
              <MenuButton
                label="Minimieren"
                onClick={() => {
                  setMenu(null);
                  onMinimize();
                }}
              />
              <MenuButton
                label="Beenden & speichern"
                loading={finish.isPending}
                onClick={() => {
                  setMenu(null);
                  finishWorkout();
                }}
              />
              <MenuButton
                label="Abbrechen & verwerfen"
                danger
                onClick={() => {
                  setMenu(null);
                  setConfirmDiscard(true);
                }}
              />
            </>
          )}
        </div>
      </Sheet>

      <Sheet
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title={editing ? 'Training löschen?' : 'Training verwerfen?'}
        description={
          editing
            ? 'Das Training verschwindet mit allen Sätzen, Kommentaren und Reaktionen. Das lässt sich nicht rückgängig machen.'
            : 'Alle Sätze dieses Trainings werden gelöscht. Das lässt sich nicht rückgängig machen.'
        }
      >
        <div className="flex flex-col gap-2">
          <Button
            variant="danger"
            fullWidth
            loading={discard.isPending || deleteWorkout.isPending}
            onClick={() => {
              const done = {
                onSuccess: () => {
                  setConfirmDiscard(false);
                  onClose();
                },
              };
              if (editing) deleteWorkout.mutate(workout.id, done);
              else discard.mutate(workout.id, done);
            }}
          >
            {editing ? 'Löschen' : 'Verwerfen'}
          </Button>
          <Button
            variant="ghost"
            fullWidth
            onClick={() => {
              setConfirmDiscard(false);
            }}
          >
            {editing ? 'Behalten' : 'Weiter trainieren'}
          </Button>
        </div>
      </Sheet>

      {editing && (
        <Sheet open={timeOpen} onOpenChange={setTimeOpen} title="Tag, Uhrzeit & Dauer">
          {timeOpen && (
            <WorkoutTimeForm
              workout={workout}
              onDone={() => {
                setTimeOpen(false);
              }}
            />
          )}
        </Sheet>
      )}

      <Sheet
        open={summary !== null}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title="Starkes Training! 💪"
      >
        {summary && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-2">
              <Stat
                label="Dauer"
                value={formatDuration(
                  (new Date(summary.endedAt).getTime() - new Date(summary.startedAt).getTime()) /
                    1000 -
                    summary.pausedSeconds,
                )}
              />
              <Stat label="Arbeitssätze" value={String(summary.workingSets)} />
              <Stat label="Volumen" value={`${formatKg(Math.round(summary.volumeKg))} kg`} />
            </div>
            <NewBests workoutId={summary.id} exercises={summary.exerciseList} />
            {summary.location && summary.deviceless.length > 0 && (
              <RememberDevices
                locationId={summary.location.id}
                locationName={summary.location.name}
                items={summary.deviceless}
              />
            )}
            <SaveAsTemplate
              workoutId={summary.id}
              trainingTypeId={summary.trainingTypeId}
              focusId={summary.focusId}
              templateId={summary.templateId}
              exerciseIds={summary.exerciseIds}
            />
            <Button size="lg" fullWidth onClick={onClose}>
              Fertig
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}

/** New bests of the workout just finished, with the previous best. */
function NewBests({ workoutId, exercises }: { workoutId: string; exercises: ExerciseSummary[] }) {
  const records = useWorkoutRecords(workoutId).data ?? [];
  if (records.length === 0) return null;
  return (
    <section className="flex flex-col gap-2 rounded-card bg-surface-2 p-4">
      <h3 className="text-subhead font-semibold">
        {records.length === 1 ? 'Neuer Bestwert 🏆' : `${String(records.length)} neue Bestwerte 🏆`}
      </h3>
      <ul className="flex flex-col gap-1">
        {records.map((record) => {
          const exercise = exercises.find((e) => e.id === record.exerciseId);
          if (!exercise) return null;
          return (
            <li key={record.exerciseId} className="flex items-baseline justify-between gap-3">
              <span className="truncate text-subhead">{exercise.name}</span>
              <span className="shrink-0 text-footnote tabular-nums">
                <span className="font-semibold">{formatSet(exercise.measure, record)}</span>
                <span className="text-text-subtle">
                  {' '}
                  vorher{' '}
                  {formatSet(exercise.measure, {
                    weightKg: record.previousWeightKg,
                    reps: record.previousReps,
                    durationSeconds: record.previousDurationSeconds,
                  })}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ElapsedTime({ workout }: { workout: ActiveWorkout }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, []);
  return (
    <span
      className={cn('text-title-3 font-semibold tabular-nums', workout.pausedAt && 'text-warning')}
    >
      {formatDuration(elapsedSeconds(workout, now))}
      {workout.pausedAt && ' · Pause'}
    </span>
  );
}

function ExerciseChips({
  items,
  activeId,
  onSelect,
  onReorder,
}: {
  items: WorkoutItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onReorder: (items: WorkoutItem[]) => void;
}) {
  // Long press (250 ms) starts dragging, so normal taps and horizontal scrolling still work.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((item) => item.id === active.id);
    const to = items.findIndex((item) => item.id === over.id);
    onReorder(arrayMove(items, from, to));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={horizontalListSortingStrategy}
      >
        <div className="no-scrollbar flex shrink-0 gap-2 overflow-x-auto px-gutter py-2">
          {items.map((item) => (
            <SortableChip
              key={item.id}
              item={item}
              selected={item.id === activeId}
              onSelect={() => {
                onSelect(item.id);
              }}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableChip({
  item,
  selected,
  onSelect,
}: {
  item: WorkoutItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const done = item.sets.length > 0 && item.sets.every((set) => set.completedAt !== null);
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('shrink-0 touch-manipulation', isDragging && 'z-10 opacity-80')}
      {...attributes}
      {...listeners}
    >
      <Chip selected={selected} onClick={onSelect}>
        {done && '✓ '}
        {item.exercise.name}
      </Chip>
    </div>
  );
}

function NoteSheet({ item, onClose }: { item: WorkoutItem | null; onClose: () => void }) {
  return (
    <Sheet
      open={item !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Notiz"
    >
      {/* Keyed by item so the draft starts from that item's note. */}
      {item && <NoteForm key={item.id} item={item} onDone={onClose} />}
    </Sheet>
  );
}

function NoteForm({ item, onDone }: { item: WorkoutItem; onDone: () => void }) {
  const update = useUpdateItemNote();
  const [note, setNote] = useState(item.note ?? '');
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        update.mutate({ itemId: item.id, note });
        onDone();
      }}
    >
      <TextField
        label="Notiz zur Übung"
        value={note}
        maxLength={500}
        onChange={(event) => {
          setNote(event.target.value);
        }}
      />
      <Button type="submit">Speichern</Button>
    </form>
  );
}

function MenuButton({
  label,
  onClick,
  danger = false,
  loading = false,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <Button variant={danger ? 'danger' : 'secondary'} fullWidth loading={loading} onClick={onClick}>
      {label}
    </Button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card elevated className="flex flex-col items-center gap-1 px-2">
      <span className="text-title-3 font-semibold tabular-nums">{value}</span>
      <span className="text-caption text-text-muted">{label}</span>
    </Card>
  );
}

const editDate = new Intl.DateTimeFormat('de', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

/** Active seconds of a workout: its duration, else start to end minus pauses. */
function workoutSeconds(workout: ActiveWorkout): number {
  if (workout.durationSeconds !== null) return workout.durationSeconds;
  if (!workout.endedAt) return 0;
  return Math.max(
    0,
    (new Date(workout.endedAt).getTime() - new Date(workout.startedAt).getTime()) / 1000 -
      workout.pausedSeconds,
  );
}

/** "58 Min" / "1 h 12 Min" */
function formatMinutesShort(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${String(minutes)} Min`;
  const rest = minutes % 60;
  return `${String(Math.floor(minutes / 60))} h${rest ? ` ${String(rest)} Min` : ''}`;
}

function WorkoutTimeForm({ workout, onDone }: { workout: ActiveWorkout; onDone: () => void }) {
  const [when, setWhen] = useState<When>(() =>
    whenFrom(new Date(workout.startedAt), workoutSeconds(workout)),
  );
  const update = useUpdateWorkoutTime(workout.id);
  const parsed = parseWhen(when);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        update.mutate(
          { startedAt: parsed.start, durationMinutes: parsed.minutes },
          { onSuccess: onDone },
        );
      }}
    >
      <WhenFields value={when} onChange={setWhen} />
      {update.isError && (
        <p role="alert" className="text-footnote text-danger">
          Speichern hat nicht geklappt.
        </p>
      )}
      <Button type="submit" missing={parsed.missing} loading={update.isPending}>
        Speichern
      </Button>
    </form>
  );
}
