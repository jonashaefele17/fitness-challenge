import { useState } from 'react';
import { showToast } from '@/shared/lib';
import {
  Button,
  ChevronRightIcon,
  CloseIcon,
  PlusIcon,
  Sheet,
  Switch,
  TextField,
} from '@/shared/ui';
import {
  useAddPause,
  useArchiveHabit,
  useHabitTemplates,
  useMyHabits,
  usePauses,
  useRemovePause,
  useReminders,
  useSaveReminders,
  useSaveHabit,
} from '../api/useHabits';
import { todayKey } from '../dates';
import { EMPTY_HABIT } from '../defaults';
import { summaryText } from '../habitText';
import type { Habit, HabitDefinition, HabitTemplate } from '../types';
import { HabitEditor } from './HabitEditor';

type Editing =
  { kind: 'habit'; habit: Habit } | { kind: 'new'; template: HabitTemplate | null } | null;

const shortDate = new Intl.DateTimeFormat('de', { day: 'numeric', month: 'short' });

/**
 * Ich → Habits: my habits (add from the library or own, change, archive) and pauses
 * (ill, holiday). Recommended: 3–7 habits.
 */
export function HabitsSettings() {
  const habits = useMyHabits().data ?? [];
  const active = habits.filter((h) => !h.archived);
  const archived = habits.filter((h) => h.archived);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const save = useSaveHabit();
  const archive = useArchiveHabit();

  function onSave(definition: HabitDefinition) {
    if (!editing) return;
    save.mutate(
      {
        habitId: editing.kind === 'habit' ? editing.habit.id : null,
        templateId: editing.kind === 'new' ? (editing.template?.id ?? null) : null,
        validFrom: todayKey(),
        definition,
      },
      {
        onSuccess: () => {
          setEditing(null);
          setLibraryOpen(false);
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-footnote font-semibold text-text-muted">Meine Habits</h2>
          <Button
            variant="ghost"
            onClick={() => {
              setLibraryOpen(true);
            }}
          >
            <PlusIcon aria-hidden /> Habit
          </Button>
        </div>
        {active.length === 0 ? (
          <p className="text-subhead text-text-muted">
            Noch keine Habits. Fang mit 3 bis 7 an – zum Beispiel aus der Bibliothek.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
            {active.map((habit) => (
              <li key={habit.id}>
                <button
                  type="button"
                  onClick={() => {
                    setEditing({ kind: 'habit', habit });
                  }}
                  className="flex min-h-tap w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-3"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-subhead font-semibold">
                      {habit.current.name}
                    </span>
                    <span className="truncate text-footnote text-text-muted">
                      {summaryText(habit.current)}
                    </span>
                  </span>
                  <ChevronRightIcon aria-hidden className="shrink-0 text-text-subtle" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {archived.length > 0 && (
          <details className="text-subhead">
            <summary className="flex min-h-tap cursor-pointer items-center text-text-muted">
              Archiviert ({archived.length})
            </summary>
            <ul className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
              {archived.map((habit) => (
                <li
                  key={habit.id}
                  className="flex min-h-tap items-center justify-between gap-3 pl-4"
                >
                  <span className="truncate text-text-muted">{habit.current.name}</span>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      archive.mutate({ habitId: habit.id, archive: false });
                    }}
                  >
                    Wieder aufnehmen
                  </Button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <Reminders />

      <Pauses />

      <Sheet open={libraryOpen} onOpenChange={setLibraryOpen} title="Habit hinzufügen">
        <Library
          taken={active.flatMap((h) => h.templateId ?? [])}
          onPick={(template) => {
            setEditing({ kind: 'new', template });
          }}
        />
      </Sheet>

      <Sheet
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        title={editing?.kind === 'habit' ? editing.habit.current.name : 'Neues Habit'}
      >
        {editing && (
          <HabitEditor
            key={editing.kind === 'habit' ? editing.habit.id : (editing.template?.id ?? 'own')}
            initial={
              editing.kind === 'habit'
                ? editing.habit.current
                : editing.template
                  ? { ...editing.template }
                  : EMPTY_HABIT
            }
            isNew={editing.kind === 'new'}
            saving={save.isPending}
            onSave={onSave}
            onArchive={
              editing.kind === 'habit'
                ? () => {
                    const habitId = editing.habit.id;
                    archive.mutate({ habitId, archive: true });
                    setEditing(null);
                    showToast(`${editing.habit.current.name} archiviert`, {
                      label: 'Rückgängig',
                      onAction: () => {
                        archive.mutate({ habitId, archive: false });
                      },
                    });
                  }
                : undefined
            }
          />
        )}
      </Sheet>
    </div>
  );
}

function Library({
  taken,
  onPick,
}: {
  taken: string[];
  onPick: (template: HabitTemplate | null) => void;
}) {
  const templates = (useHabitTemplates().data ?? []).filter((t) => !taken.includes(t.id));
  return (
    <div className="flex flex-col gap-3 pt-1">
      <ul className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
        {templates.map((template) => (
          <li key={template.id}>
            <button
              type="button"
              onClick={() => {
                onPick(template);
              }}
              className="flex min-h-tap w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-3"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-subhead font-semibold">{template.name}</span>
                <span className="truncate text-footnote text-text-muted">
                  {template.description ?? summaryText(template)}
                </span>
              </span>
              <ChevronRightIcon aria-hidden className="shrink-0 text-text-subtle" />
            </button>
          </li>
        ))}
      </ul>
      <Button
        variant="secondary"
        onClick={() => {
          onPick(null);
        }}
      >
        Eigenes Habit anlegen
      </Button>
    </div>
  );
}

/** Ill or on holiday: those days count neither way, week targets shrink. */
/**
 * Check-in reminders: in the morning and in the evening, each on or off with its time. A
 * push only comes when something of that time of day is still open.
 */
function Reminders() {
  const saved = useReminders().data;
  const save = useSaveReminders();
  if (!saved) return null;
  const rows = [
    { key: 'morningAt' as const, label: 'Morgens', fallback: '08:00' },
    { key: 'eveningAt' as const, label: 'Abends', fallback: '21:00' },
  ];
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-footnote font-semibold text-text-muted">Erinnerungen</h2>
      <p className="text-footnote text-text-muted">
        Eine Push zum Check-in, wenn zu der Zeit noch etwas offen ist. Supplements haben ihre eigene
        Uhrzeit pro Punkt (im Habit einstellen).
      </p>
      <ul className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
        {rows.map((row) => {
          const value = saved[row.key];
          return (
            <li key={row.key} className="flex min-h-tap items-center gap-3 px-4 py-2">
              <span className="flex-1">
                <Switch
                  label={row.label}
                  checked={value !== null}
                  onCheckedChange={(on) => {
                    save.mutate({ ...saved, [row.key]: on ? row.fallback : null });
                  }}
                />
              </span>
              {value !== null && (
                <input
                  type="time"
                  aria-label={`Uhrzeit ${row.label}`}
                  value={value}
                  onChange={(event) => {
                    if (event.target.value) {
                      save.mutate({ ...saved, [row.key]: event.target.value });
                    }
                  }}
                  className="h-tap rounded-sm bg-surface-3 px-2 text-subhead tabular-nums"
                />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Pauses() {
  const pauses = usePauses().data ?? [];
  const add = useAddPause();
  const remove = useRemovePause();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(todayKey);
  const [to, setTo] = useState(todayKey);
  const [note, setNote] = useState('');
  const format = (day: string) => shortDate.format(new Date(`${day}T12:00:00`));

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-footnote font-semibold text-text-muted">Pausen</h2>
        <Button
          variant="ghost"
          onClick={() => {
            setFrom(todayKey());
            setTo(todayKey());
            setNote('');
            setOpen(true);
          }}
        >
          <PlusIcon aria-hidden /> Pause
        </Button>
      </div>
      <p className="text-footnote text-text-muted">
        Krank oder im Urlaub: Diese Tage zählen weder dafür noch dagegen, Wochenziele werden
        anteilig kleiner.
      </p>
      {pauses.length > 0 && (
        <ul className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
          {pauses.map((pause) => (
            <li key={pause.id} className="flex min-h-tap items-center justify-between gap-3 pl-4">
              <span className="truncate text-subhead">
                {pause.fromDate === pause.toDate
                  ? format(pause.fromDate)
                  : `${format(pause.fromDate)} – ${format(pause.toDate)}`}
                {pause.note ? <span className="text-text-muted"> · {pause.note}</span> : null}
              </span>
              <button
                type="button"
                aria-label="Pause entfernen"
                onClick={() => {
                  remove.mutate(pause.id);
                  showToast('Pause entfernt', {
                    label: 'Rückgängig',
                    onAction: () => {
                      add.mutate({
                        fromDate: pause.fromDate,
                        toDate: pause.toDate,
                        note: pause.note ?? '',
                      });
                    },
                  });
                }}
                className="flex size-tap items-center justify-center text-text-subtle active:bg-surface-3"
              >
                <CloseIcon />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Sheet open={open} onOpenChange={setOpen} title="Pause eintragen">
        <form
          className="flex flex-col gap-6 pt-1"
          onSubmit={(event) => {
            event.preventDefault();
            add.mutate(
              { fromDate: from, toDate: to, note },
              {
                onSuccess: () => {
                  setOpen(false);
                },
              },
            );
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Von"
              type="date"
              className="h-tap appearance-none"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                if (event.target.value > to) setTo(event.target.value);
              }}
            />
            <TextField
              label="Bis"
              type="date"
              className="h-tap appearance-none"
              min={from}
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
              }}
            />
          </div>
          <TextField
            label="Grund (optional)"
            placeholder="z. B. krank, Urlaub"
            value={note}
            maxLength={100}
            onChange={(event) => {
              setNote(event.target.value);
            }}
          />
          <Button
            type="submit"
            size="lg"
            missing={from && to ? null : 'Wähl Anfang und Ende.'}
            loading={add.isPending}
          >
            Pause eintragen
          </Button>
        </form>
      </Sheet>
    </section>
  );
}
