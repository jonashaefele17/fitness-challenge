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
  useDiscardWorkout,
  useFinishWorkout,
  useRemoveItem,
  useReorderItems,
  useRestoreItem,
  useSwapExercise,
  useTogglePause,
  useSetItemDevice,
  useSetWorkoutLocation,
  useUpdateItemNote,
  type FinishedWorkout,
} from '../api/useWorkout';
import {
  elapsedSeconds,
  formatDuration,
  formatKg,
  summarize,
  type WorkoutSummary,
} from '../format';
import type { ActiveWorkout, Device, ExerciseSummary, WorkoutItem } from '../types';
import { ExercisePickerSheet } from './ExercisePickerSheet';
import { DevicePickerSheet } from './DevicePickerSheet';
import { DeviceSheet } from './DeviceSheet';
import { PlacePicker } from './PlacePicker';
import { ExerciseCard } from './ExerciseCard';

export interface WorkoutScreenProps {
  workout: ActiveWorkout;
  /** Leave the screen; the workout keeps running (mini bar). */
  onMinimize: () => void;
  /** After finishing and closing the summary, or after discarding. */
  onClose: () => void;
}

type Menu = { kind: 'workout' } | { kind: 'item'; item: WorkoutItem } | null;

export function WorkoutScreen({ workout, onMinimize, onClose }: WorkoutScreenProps) {
  const [activeId, setActiveId] = useState<string | null>(workout.items[0]?.id ?? null);
  const [menu, setMenu] = useState<Menu>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [swapItem, setSwapItem] = useState<WorkoutItem | null>(null);
  const [noteItem, setNoteItem] = useState<WorkoutItem | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [pickDeviceFor, setPickDeviceFor] = useState<WorkoutItem | null>(null);
  const [deviceTarget, setDeviceTarget] = useState<{
    device: Device;
    exercise: ExerciseSummary;
  } | null>(null);
  const setItemDevice = useSetItemDevice();
  const setLocation = useSetWorkoutLocation(workout.id);
  const [summary, setSummary] = useState<(WorkoutSummary & FinishedWorkout) | null>(null);

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
        setSummary({ ...stats, ...finished });
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
          aria-label="Minimieren"
          onClick={onMinimize}
          className="flex size-tap items-center justify-center rounded-pill text-title-2 text-accent active:bg-surface-2"
        >
          <ChevronDownIcon />
        </button>
        <div className="flex min-w-0 flex-col items-center text-center">
          <span className="max-w-full truncate text-footnote text-text-muted">
            {workout.trainingType.name}
            {workout.location ? ` · ${workout.location.name}` : ''}
          </span>
          <ElapsedTime workout={workout} />
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
          ) : (
            // Last exercise: the same spot finishes the workout.
            <Button loading={finish.isPending} onClick={finishWorkout}>
              Beenden ✓
            </Button>
          )}
        </nav>
      )}

      <ExercisePickerSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        place={workout.location}
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
        onPick={(exercise, device) => {
          if (!swapItem) return;
          swap.mutate({ itemId: swapItem.id, exercise });
          setItemDevice.mutate({ itemId: swapItem.id, device });
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
        title="Training verwerfen?"
        description="Alle Sätze dieses Trainings werden gelöscht. Das lässt sich nicht rückgängig machen."
      >
        <div className="flex flex-col gap-2">
          <Button
            variant="danger"
            fullWidth
            loading={discard.isPending}
            onClick={() => {
              discard.mutate(workout.id, {
                onSuccess: () => {
                  setConfirmDiscard(false);
                  onClose();
                },
              });
            }}
          >
            Verwerfen
          </Button>
          <Button
            variant="ghost"
            fullWidth
            onClick={() => {
              setConfirmDiscard(false);
            }}
          >
            Weiter trainieren
          </Button>
        </div>
      </Sheet>

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
            <Button size="lg" fullWidth onClick={onClose}>
              Fertig
            </Button>
          </div>
        )}
      </Sheet>
    </div>
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
