import { useState } from 'react';
import { cn } from '@/shared/lib';
import { Button, CloseIcon, FieldGroup, SegmentedControl, TextField } from '@/shared/ui';
import type { HabitCondition, HabitDefinition, HabitInputType } from '../types';

const chip =
  'flex min-h-tap shrink-0 items-center justify-center rounded-pill border px-4 text-subhead font-semibold';
const on = 'border-accent bg-accent text-on-accent';
const off = 'border-border bg-surface-2 active:bg-surface-3';
const WEEKDAYS = ['', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/** Types one can pick for an own habit (a choice comes with its template). */
const OWN_TYPES: { value: HabitInputType; label: string }[] = [
  { value: 'yes_no', label: 'Ja/Nein' },
  { value: 'number', label: 'Zahl' },
  { value: 'duration', label: 'Dauer' },
  { value: 'time_pair', label: 'Uhrzeit-Paar' },
  { value: 'checklist', label: 'Checkliste' },
];

/** A fresh rule fitting the input type. */
function ruleFor(type: HabitInputType): HabitCondition[] {
  if (type === 'number') return [{ op: 'min', value: 1 }];
  if (type === 'duration') return [{ op: 'min', value: 60 }];
  if (type === 'time_pair') return [{ field: 'duration', op: 'min', value: 420 }];
  return [];
}

/**
 * Name, what is asked and the rule, how often, morning or evening. A habit fed from
 * trainings only sets how often per week.
 */
export function HabitEditor({
  initial,
  isNew,
  saving,
  onSave,
  onArchive,
}: {
  initial: HabitDefinition;
  isNew: boolean;
  saving: boolean;
  onSave: (definition: HabitDefinition) => void;
  onArchive?: (() => void) | undefined;
}) {
  const [def, setDef] = useState(initial);
  const [newItem, setNewItem] = useState('');
  const fromTrainings = def.source === 'training';
  const set = (changes: Partial<HabitDefinition>) => {
    setDef((current) => ({ ...current, ...changes }));
  };
  const condition = def.rule.find((c) => c.field !== 'start') ?? null;
  const bedBefore = def.rule.find((c) => c.field === 'start')?.value;
  const setCondition = (next: HabitCondition) => {
    set({ rule: [next, ...def.rule.filter((c) => c.field === 'start')] });
  };

  const missing = !def.name.trim()
    ? 'Gib dem Habit einen Namen.'
    : def.frequency === 'weekdays' && def.weekdays.length === 0
      ? 'Wähl mindestens einen Wochentag.'
      : def.inputType === 'checklist' && def.options.length === 0
        ? 'Leg mindestens einen Punkt an.'
        : null;

  return (
    <form
      className="flex flex-col gap-6 pt-1"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ ...def, name: def.name.trim() });
      }}
    >
      <TextField
        label="Name"
        value={def.name}
        maxLength={60}
        onChange={(event) => {
          set({ name: event.target.value });
        }}
      />

      {isNew && !fromTrainings && def.inputType !== 'choice' && (
        <FieldGroup label="Was trägst du ein?">
          <div className="-mx-gutter no-scrollbar flex gap-2 overflow-x-auto px-gutter">
            {OWN_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                aria-pressed={def.inputType === type.value}
                onClick={() => {
                  set({ inputType: type.value, rule: ruleFor(type.value), unit: null });
                }}
                className={cn(chip, def.inputType === type.value ? on : off)}
              >
                {type.label}
              </button>
            ))}
          </div>
        </FieldGroup>
      )}

      {(def.inputType === 'number' || def.inputType === 'duration') && condition && (
        <FieldGroup label="Ziel">
          <div className="flex flex-col gap-3">
            <SegmentedControl
              label="Ziel"
              value={condition.op === 'max' ? 'max' : 'min'}
              onChange={(op) => {
                setCondition({ ...condition, op });
              }}
              options={[
                { value: 'min', label: 'Mindestens' },
                { value: 'max', label: 'Höchstens' },
              ]}
            />
            {def.inputType === 'number' ? (
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  label="Wert"
                  type="number"
                  inputMode="decimal"
                  value={String(condition.value)}
                  onChange={(event) => {
                    setCondition({ ...condition, value: Number(event.target.value) || 0 });
                  }}
                />
                <TextField
                  label="Einheit"
                  placeholder="z. B. Schritte"
                  value={def.unit ?? ''}
                  maxLength={20}
                  onChange={(event) => {
                    set({ unit: event.target.value || null });
                  }}
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  label="Stunden"
                  type="number"
                  inputMode="numeric"
                  value={String(Math.floor(Number(condition.value) / 60))}
                  onChange={(event) => {
                    setCondition({
                      ...condition,
                      value:
                        (Number(event.target.value) || 0) * 60 + (Number(condition.value) % 60),
                    });
                  }}
                />
                <TextField
                  label="Minuten"
                  type="number"
                  inputMode="numeric"
                  value={String(Number(condition.value) % 60)}
                  onChange={(event) => {
                    setCondition({
                      ...condition,
                      value:
                        Math.floor(Number(condition.value) / 60) * 60 +
                        (Number(event.target.value) || 0),
                    });
                  }}
                />
              </div>
            )}
          </div>
        </FieldGroup>
      )}

      {def.inputType === 'time_pair' && (
        <FieldGroup label="Ziel">
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Mindestens (Stunden)"
              type="number"
              inputMode="decimal"
              step="0.5"
              value={String(Number(condition?.value ?? 420) / 60)}
              onChange={(event) => {
                setCondition({
                  field: 'duration',
                  op: 'min',
                  value: Math.round((Number(event.target.value.replace(',', '.')) || 0) * 60),
                });
              }}
            />
            <TextField
              label="Ins Bett vor (optional)"
              type="time"
              className="h-tap appearance-none"
              value={typeof bedBefore === 'string' ? bedBefore : ''}
              onChange={(event) => {
                const others = def.rule.filter((c) => c.field !== 'start');
                set({
                  rule: event.target.value
                    ? [...others, { field: 'start', op: 'before', value: event.target.value }]
                    : others,
                });
              }}
            />
          </div>
        </FieldGroup>
      )}

      {def.inputType === 'checklist' && (
        <FieldGroup label="Punkte">
          <div className="flex flex-col gap-2">
            {def.options.length > 0 && (
              <ul className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
                {def.options.map((o) => (
                  <li
                    key={o.key}
                    className="flex min-h-tap items-center justify-between gap-3 pl-4"
                  >
                    <span className="truncate text-subhead">{o.label}</span>
                    <button
                      type="button"
                      aria-label={`${o.label} entfernen`}
                      onClick={() => {
                        set({ options: def.options.filter((x) => x.key !== o.key) });
                      }}
                      className="flex size-tap items-center justify-center text-text-subtle active:bg-surface-3"
                    >
                      <CloseIcon />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <TextField
                  label="Neuer Punkt"
                  placeholder="z. B. Magnesium"
                  value={newItem}
                  maxLength={40}
                  onChange={(event) => {
                    setNewItem(event.target.value);
                  }}
                />
              </div>
              <Button
                variant="secondary"
                missing={newItem.trim() ? null : 'Gib dem Punkt einen Namen.'}
                onClick={() => {
                  set({
                    options: [...def.options, { key: crypto.randomUUID(), label: newItem.trim() }],
                  });
                  setNewItem('');
                }}
              >
                Hinzufügen
              </Button>
            </div>
          </div>
        </FieldGroup>
      )}

      <FieldGroup label="Wie oft?">
        <div className="flex flex-col gap-3">
          {!fromTrainings && (
            <SegmentedControl
              label="Wie oft"
              value={def.frequency}
              onChange={(frequency) => {
                set({
                  frequency,
                  timesPerWeek: frequency === 'weekly' ? (def.timesPerWeek ?? 3) : null,
                  weekdays: frequency === 'weekdays' ? def.weekdays : [],
                });
              }}
              options={[
                { value: 'daily', label: 'Täglich' },
                { value: 'weekdays', label: 'Wochentage' },
                { value: 'weekly', label: 'Pro Woche' },
              ]}
            />
          )}
          {def.frequency === 'weekdays' && (
            <div className="grid grid-cols-7 gap-1">
              {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                const active = def.weekdays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      set({
                        weekdays: active
                          ? def.weekdays.filter((d) => d !== day)
                          : [...def.weekdays, day].sort(),
                      });
                    }}
                    className={cn(chip, 'px-0 text-footnote', active ? on : off)}
                  >
                    {WEEKDAYS[day]}
                  </button>
                );
              })}
            </div>
          )}
          {def.frequency === 'weekly' && (
            <div className="grid grid-cols-7 gap-1">
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={def.timesPerWeek === n}
                  aria-label={`${String(n)}× pro Woche`}
                  onClick={() => {
                    set({ timesPerWeek: n });
                  }}
                  className={cn(chip, 'px-0 text-footnote', def.timesPerWeek === n ? on : off)}
                >
                  {n}×
                </button>
              ))}
            </div>
          )}
        </div>
      </FieldGroup>

      {!fromTrainings && (
        <SegmentedControl
          label="Wann im Check-in"
          value={def.timeOfDay}
          onChange={(timeOfDay) => {
            set({ timeOfDay });
          }}
          options={[
            { value: 'morning', label: 'Morgens' },
            { value: 'evening', label: 'Abends' },
          ]}
        />
      )}

      <div className="flex flex-col gap-2">
        {!isNew && (
          <p className="text-footnote text-text-muted">
            Änderungen gelten ab heute. Frühere Tage bleiben nach der alten Regel bewertet.
          </p>
        )}
        <Button type="submit" size="lg" missing={missing} loading={saving}>
          {isNew ? 'Hinzufügen' : 'Speichern'}
        </Button>
        {onArchive && (
          <Button variant="ghost" onClick={onArchive}>
            Archivieren
          </Button>
        )}
      </div>
    </form>
  );
}
