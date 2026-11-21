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
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import { cn } from '@/shared/lib';
import { Button, TextField } from '@/shared/ui';
import { useTrainingFocuses, useTrainingTypes } from '../../api/useCatalog';
import { useHomeStudio, usePlaces } from '../../api/usePlaces';
import { useSaveTemplate } from '../../api/useTemplates';
import type { TemplateDraft, TemplateItem } from '../../types';
import { ExercisePickerSheet } from '../ExercisePickerSheet';
import { TrainingTypeIcon } from '../TrainingTypeIcon';

const chip =
  'flex min-h-tap shrink-0 items-center gap-2 rounded-pill border px-3 text-subhead font-semibold';

/**
 * Create or edit a template: name, training type, focus, and the exercises with sets,
 * warm-up sets and rep range (or target time). Long-press an exercise to reorder it.
 */
export function TemplateEditor({
  initial,
  onSaved,
}: {
  initial: TemplateDraft;
  onSaved: (templateId: string) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [picking, setPicking] = useState(false);
  const types = (useTrainingTypes().data ?? []).filter((type) => type.kind === 'exercises');
  const focuses = useTrainingFocuses().data ?? [];
  const homeId = useHomeStudio().data ?? null;
  const home = (usePlaces().data ?? []).find((place) => place.id === homeId) ?? null;
  const save = useSaveTemplate();
  // Items need stable keys for reordering; an exercise appears once per template.
  const ids = draft.items.map((item) => item.exercise.id);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  function update(index: number, changes: Partial<TemplateItem>) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item, i) => (i === index ? { ...item, ...changes } : item)),
    }));
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setDraft((current) => ({
      ...current,
      items: arrayMove(current.items, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))),
    }));
  }

  const valid = draft.name.trim().length >= 2 && draft.items.length > 0;

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate(draft, { onSuccess: onSaved });
      }}
    >
      <TextField
        label="Name"
        placeholder="z. B. Push · Studio"
        value={draft.name}
        maxLength={60}
        onChange={(event) => {
          setDraft({ ...draft, name: event.target.value });
        }}
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-subhead text-text-muted">Trainingsart</legend>
        <div className="-mx-gutter no-scrollbar flex gap-2 overflow-x-auto px-gutter">
          {types.map((type) => (
            <button
              key={type.id}
              type="button"
              aria-pressed={draft.trainingTypeId === type.id}
              onClick={() => {
                setDraft({ ...draft, trainingTypeId: type.id });
              }}
              className={cn(
                chip,
                draft.trainingTypeId === type.id
                  ? 'border-accent bg-accent text-on-accent'
                  : 'border-border bg-surface-2',
              )}
            >
              <TrainingTypeIcon icon={type.icon} className="size-4" />
              {type.name}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-subhead text-text-muted">Fokus</legend>
        <div className="-mx-gutter no-scrollbar flex gap-2 overflow-x-auto px-gutter">
          {focuses.map((focus) => {
            const on = draft.focusId === focus.id;
            return (
              <button
                key={focus.id}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setDraft({ ...draft, focusId: on ? null : focus.id });
                }}
                className={cn(
                  chip,
                  on ? 'border-accent bg-accent text-on-accent' : 'border-border bg-surface-2',
                )}
              >
                {focus.name}
              </button>
            );
          })}
        </div>
      </fieldset>

      <section className="flex flex-col gap-2">
        <h3 className="text-subhead text-text-muted">Übungen</h3>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col gap-2">
              {draft.items.map((item, index) => (
                <ItemRow
                  key={item.exercise.id}
                  item={item}
                  onChange={(changes) => {
                    update(index, changes);
                  }}
                  onRemove={() => {
                    setDraft({ ...draft, items: draft.items.filter((_, i) => i !== index) });
                  }}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
        {draft.items.length > 1 && (
          <p className="text-footnote text-text-subtle">
            Lange drücken und ziehen zum Umsortieren.
          </p>
        )}
        <Button
          variant="secondary"
          onClick={() => {
            setPicking(true);
          }}
        >
          + Übung
        </Button>
      </section>

      <TextField
        label="Notiz (optional)"
        value={draft.note}
        maxLength={500}
        onChange={(event) => {
          setDraft({ ...draft, note: event.target.value });
        }}
      />

      {save.isError && (
        <p role="alert" className="text-footnote text-danger">
          Speichern hat nicht geklappt.
        </p>
      )}
      <Button type="submit" disabled={!valid} loading={save.isPending}>
        Vorlage speichern
      </Button>

      <ExercisePickerSheet
        open={picking}
        onOpenChange={setPicking}
        title="Übung zur Vorlage"
        place={home}
        focusId={draft.focusId}
        onFocusChange={(focusId) => {
          setDraft({ ...draft, focusId });
        }}
        onPick={(exercise, device) => {
          if (ids.includes(exercise.id)) return;
          setDraft((current) => ({
            ...current,
            items: [
              ...current.items,
              {
                exercise,
                deviceType: device ? { id: device.typeId, name: device.name } : null,
                sets: 3,
                warmupSets: 0,
                repMin: exercise.measure === 'duration' ? null : 8,
                repMax: exercise.measure === 'duration' ? null : 12,
                durationSeconds: exercise.measure === 'duration' ? 45 : null,
                note: null,
              },
            ],
          }));
        }}
      />
    </form>
  );
}

function ItemRow({
  item,
  onChange,
  onRemove,
}: {
  item: TemplateItem;
  onChange: (changes: Partial<TemplateItem>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.exercise.id,
  });
  const duration = item.exercise.measure === 'duration';
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex flex-col gap-2 rounded-card bg-surface-2 px-4 py-3',
        isDragging && 'z-10 opacity-80',
      )}
    >
      <div className="flex items-start justify-between gap-2" {...attributes} {...listeners}>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-subhead font-semibold">{item.exercise.name}</span>
          <span className="truncate text-footnote text-text-muted">
            {item.deviceType?.name ?? 'ohne Gerät'}
          </span>
        </span>
        <button
          type="button"
          aria-label={`${item.exercise.name} entfernen`}
          onClick={onRemove}
          className="-mt-2 -mr-2 flex size-tap shrink-0 items-center justify-center rounded-pill text-title-3 text-text-muted active:bg-surface-3"
        >
          ×
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Stepper
          label="Sätze"
          value={item.sets}
          min={1}
          max={20}
          onChange={(sets) => {
            onChange({ sets });
          }}
        />
        <Stepper
          label="Aufwärmen"
          value={item.warmupSets}
          min={0}
          max={5}
          onChange={(warmupSets) => {
            onChange({ warmupSets });
          }}
        />
        {duration ? (
          <NumberInput
            label="Sek."
            value={item.durationSeconds}
            onChange={(durationSeconds) => {
              onChange({ durationSeconds });
            }}
          />
        ) : (
          <span className="flex items-center gap-1 text-footnote text-text-muted">
            <NumberInput
              label="Wdh. von"
              value={item.repMin}
              onChange={(repMin) => {
                onChange({ repMin });
              }}
            />
            –
            <NumberInput
              label="bis"
              value={item.repMax}
              onChange={(repMax) => {
                onChange({ repMax });
              }}
            />
            Wdh.
          </span>
        )}
      </div>
    </li>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <span className="flex items-center gap-1 text-footnote text-text-muted">
      {label}
      <button
        type="button"
        aria-label={`${label} weniger`}
        disabled={value <= min}
        onClick={() => {
          onChange(value - 1);
        }}
        className="flex size-tap items-center justify-center rounded-pill text-title-3 text-accent disabled:text-text-subtle"
      >
        −
      </button>
      <span className="w-5 text-center text-subhead font-semibold text-text tabular-nums">
        {value}
      </span>
      <button
        type="button"
        aria-label={`${label} mehr`}
        disabled={value >= max}
        onClick={() => {
          onChange(value + 1);
        }}
        className="flex size-tap items-center justify-center rounded-pill text-title-3 text-accent disabled:text-text-subtle"
      >
        +
      </button>
    </span>
  );
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <input
      aria-label={label}
      inputMode="numeric"
      value={value ?? ''}
      onChange={(event) => {
        const parsed = Number.parseInt(event.target.value, 10);
        onChange(Number.isFinite(parsed) && parsed > 0 ? parsed : null);
      }}
      className="h-tap w-12 rounded-sm bg-surface-3 text-center text-subhead font-semibold text-text tabular-nums"
    />
  );
}
