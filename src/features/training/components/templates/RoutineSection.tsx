import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import { useUserId } from '@/features/auth';
import { useMyProfile } from '@/features/profile';
import { cn } from '@/shared/lib';
import { Button, ChevronRightIcon, DragHandleIcon, Sheet, Switch } from '@/shared/ui';
import { useExerciseDetails } from '../../api/useCatalog';
import type { ExerciseSummary, TemplateItem } from '../../types';
import { CreateExerciseForm } from '../CreateExerciseForm';
import { ExercisePickerSheet } from '../ExercisePickerSheet';
import {
  routineItem,
  routineSeconds,
  timingOf,
  withTiming,
  type RoutineTiming,
} from './routineDraft';
import { Stepper } from './Stepper';

const seconds = (value: number) => `${String(value)} s`;

/**
 * A guided routine like a follow-along video: the timing (exercise, pause, rounds) is set
 * once; exercises are clicked together in the picker and dragged into order by their handle.
 * Tapping one opens its settings (both sides, switch pause) and lets you edit the exercise.
 */
export function RoutineSection({
  items,
  onChange,
  focusId,
  onFocusChange,
  allowedFocusIds,
}: {
  items: TemplateItem[];
  onChange: (items: TemplateItem[]) => void;
  focusId: string | null;
  onFocusChange: (focusId: string | null) => void;
  allowedFocusIds: string[] | null;
}) {
  // Kept here too, so the timing survives while the list is empty.
  const [timing, setTimingState] = useState<RoutineTiming>(() => timingOf(items));
  const [picking, setPicking] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const ids = items.map((item) => item.exercise.id);
  const open = items.find((item) => item.exercise.id === openId) ?? null;
  // The handle drags right away (no long press); keyboard for accessibility.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const total = routineSeconds(items, timing);

  function setTiming(changes: Partial<RoutineTiming>) {
    const next = { ...timing, ...changes };
    setTimingState(next);
    onChange(withTiming(items, next));
  }

  function updateItem(exerciseId: string, changes: Partial<TemplateItem>) {
    onChange(
      items.map((item) => (item.exercise.id === exerciseId ? { ...item, ...changes } : item)),
    );
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onChange(arrayMove(items, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
  }

  return (
    <>
      <section className="flex flex-col gap-1">
        <h3 className="text-subhead text-text-muted">Ablauf</h3>
        <div className="flex flex-col divide-y divide-border rounded-card bg-surface-2 px-4">
          <div className="flex items-center justify-between">
            <span className="text-body">Übung</span>
            <Stepper
              label="Übungszeit"
              hideLabel
              value={timing.seconds}
              min={5}
              max={300}
              step={5}
              format={seconds}
              onChange={(value) => {
                setTiming({ seconds: value });
              }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-body">Pause</span>
            <Stepper
              label="Pause"
              hideLabel
              value={timing.restSeconds}
              min={0}
              max={120}
              step={5}
              format={(value) => (value === 0 ? 'ohne' : seconds(value))}
              onChange={(value) => {
                setTiming({ restSeconds: value });
              }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-body">Runden</span>
            <Stepper
              label="Runden"
              hideLabel
              value={timing.rounds}
              min={1}
              max={10}
              onChange={(value) => {
                setTiming({ rounds: value });
              }}
            />
          </div>
        </div>
        {items.length > 0 && (
          <p className="px-1 pt-1 text-footnote text-text-subtle">
            ≈ {Math.max(1, Math.round(total / 60))} Min. ·{' '}
            {items.length === 1 ? '1 Übung' : `${String(items.length)} Übungen`}
            {timing.rounds > 1 ? ` · ${String(timing.rounds)} Runden` : ''}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-subhead text-text-muted">Übungen</h3>
        {items.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <ul className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
                {items.map((item) => (
                  <RoutineRow
                    key={item.exercise.id}
                    item={item}
                    onOpen={() => {
                      setOpenId(item.exercise.id);
                    }}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
        <Button
          variant="secondary"
          onClick={() => {
            setPicking(true);
          }}
        >
          + Übungen
        </Button>
      </section>

      <ExercisePickerSheet
        open={picking}
        onOpenChange={setPicking}
        title="Übungen zur Routine"
        place={null}
        catalog="mobility"
        allowedFocusIds={allowedFocusIds}
        focusId={focusId}
        onFocusChange={onFocusChange}
        selectedIds={ids}
        onPick={(exercise) => {
          if (!ids.includes(exercise.id)) onChange([...items, routineItem(exercise, timing)]);
        }}
        onUnpick={(exercise) => {
          onChange(items.filter((item) => item.exercise.id !== exercise.id));
        }}
      />

      <ExerciseSettingsSheet
        item={open}
        onClose={() => {
          setOpenId(null);
        }}
        onChange={(changes) => {
          if (open) updateItem(open.exercise.id, changes);
        }}
        onRemove={() => {
          if (open) onChange(items.filter((item) => item.exercise.id !== open.exercise.id));
          setOpenId(null);
        }}
      />
    </>
  );
}

function RoutineRow({ item, onOpen }: { item: TemplateItem; onOpen: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.exercise.id });
  const details = [
    item.perSide ? 'beidseitig' : null,
    item.perSide && item.sideRestSeconds > 0 ? `${String(item.sideRestSeconds)} s Wechsel` : null,
  ].filter(Boolean);
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      // Rows carry their own background (they move while dragging), so the list's rounded
      // corners are repeated on the first and last row.
      className={cn(
        'relative flex items-center overflow-hidden bg-surface-2 first:rounded-t-card last:rounded-b-card',
        isDragging && 'z-10 rounded-card opacity-80',
      )}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={`${item.exercise.name} verschieben`}
        className="flex size-tap shrink-0 touch-none items-center justify-center text-title-3 text-text-subtle"
        {...attributes}
        {...listeners}
      >
        <DragHandleIcon />
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-tap min-w-0 flex-1 items-center gap-2 py-2.5 pr-4 text-left active:bg-surface-3"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-subhead font-semibold">{item.exercise.name}</span>
          {details.length > 0 && (
            <span className="truncate text-footnote text-text-muted">{details.join(' · ')}</span>
          )}
        </span>
        <ChevronRightIcon aria-hidden className="shrink-0 text-text-subtle" />
      </button>
    </li>
  );
}

/** One exercise of the routine: both sides, the switch pause, and editing the exercise. */
function ExerciseSettingsSheet({
  item,
  onClose,
  onChange,
  onRemove,
}: {
  item: TemplateItem | null;
  onClose: () => void;
  onChange: (changes: Partial<TemplateItem>) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const details = useExerciseDetails(item?.exercise.id ?? null).data ?? null;
  const userId = useUserId();
  const isSuperAdmin = useMyProfile(userId).data?.isSuperAdmin ?? false;
  const canEdit = details !== null && (details.createdBy === userId || isSuperAdmin);

  function close() {
    setEditing(false);
    onClose();
  }

  return (
    <Sheet
      open={item !== null}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      title={editing ? 'Übung bearbeiten' : (item?.exercise.name ?? 'Übung')}
      className="min-h-sheet-min"
    >
      {item && editing && details && (
        <CreateExerciseForm
          initial={details}
          catalog={details.catalog}
          onCancel={() => {
            setEditing(false);
          }}
          onCreated={(exercise: ExerciseSummary) => {
            onChange({ exercise: { ...item.exercise, name: exercise.name } });
            setEditing(false);
          }}
        />
      )}
      {item && !editing && (
        <div className="flex flex-col gap-4">
          {details?.instructions && (
            <p className="text-subhead text-text-muted">{details.instructions}</p>
          )}
          <div className="flex flex-col divide-y divide-border rounded-card bg-surface-2 px-4">
            <Switch
              label="Beidseitig"
              description="Erst links, dann rechts"
              checked={item.perSide}
              onCheckedChange={(perSide) => {
                onChange({ perSide });
              }}
            />
            {item.perSide && (
              <div className="flex items-center justify-between">
                <span className="text-body">Pause zum Wechseln</span>
                <Stepper
                  label="Pause zum Wechseln"
                  hideLabel
                  value={item.sideRestSeconds}
                  min={0}
                  max={30}
                  step={5}
                  format={(value) => (value === 0 ? 'ohne' : seconds(value))}
                  onChange={(sideRestSeconds) => {
                    onChange({ sideRestSeconds });
                  }}
                />
              </div>
            )}
          </div>
          {canEdit && (
            <Button
              variant="secondary"
              onClick={() => {
                setEditing(true);
              }}
            >
              Übung bearbeiten
            </Button>
          )}
          <Button variant="ghost" onClick={onRemove}>
            Aus Routine entfernen
          </Button>
        </div>
      )}
    </Sheet>
  );
}
