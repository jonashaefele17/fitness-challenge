import { useState, type ReactNode } from 'react';
import { useUserId } from '@/features/auth';
import { useMyProfile } from '@/features/profile';
import { showToast } from '@/shared/lib';
import { Button, ChevronRightIcon, Sheet } from '@/shared/ui';
import {
  useAdoptHabit,
  useGroupCatalog,
  useHabitTemplates,
  useMyHabits,
  usePromoteHabit,
  useSaveHabit,
} from '../api/useHabits';
import { todayKey } from '../dates';
import { EMPTY_HABIT } from '../defaults';
import { changedFields, habitErrorText } from '../definition';
import { summaryText } from '../habitText';
import type { Habit, HabitDefinition, HabitTemplate, ShareLevel } from '../types';
import { HabitEditor } from './HabitEditor';

type CatalogHabit = Habit & { ownerName: string };

type Choice =
  | { kind: 'new'; template: HabitTemplate | null }
  // Taken over from a group mate's habit (own goals).
  | { kind: 'adopt'; source: CatalogHabit };

/**
 * Add or change a habit. habit null: a new one – first the library (templates and what
 * group mates share), then the editor; otherwise the editor of that habit. Saving an
 * unchanged rule writes no new version (only the sharing). Errors show as a toast.
 */
export function HabitSheet({
  open,
  onOpenChange,
  habit,
  onSaved,
  onArchive,
  submitLabel,
  actions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  habit: Habit | null;
  /** After saving (new or changed). */
  onSaved?: ((habitId: string, isNew: boolean) => void) | undefined;
  /** An existing habit: offer "Archivieren". */
  onArchive?: (() => void) | undefined;
  submitLabel?: string | undefined;
  /** More buttons under the submit button. */
  actions?: ReactNode;
}) {
  const [choice, setChoice] = useState<Choice | null>(null);
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setChoice(null);
  }
  const mine = (useMyHabits().data ?? []).filter((h) => !h.archived);
  const save = useSaveHabit();
  const adopt = useAdoptHabit();
  const promote = usePromoteHabit();
  const isSuperAdmin = useMyProfile(useUserId()).data?.isSuperAdmin ?? false;

  const editing: { kind: 'habit'; habit: Habit } | Choice | null = habit
    ? { kind: 'habit', habit }
    : choice;

  const failed = (error: unknown) => {
    showToast(habitErrorText(error) ?? 'Habit konnte nicht gespeichert werden.');
  };
  const finish = (habitId: string, isNew: boolean) => {
    setChoice(null);
    onOpenChange(false);
    onSaved?.(habitId, isNew);
  };

  function onSave(definition: HabitDefinition, shareLevel: ShareLevel) {
    if (!editing) return;
    if (editing.kind === 'adopt') {
      adopt.mutate(
        { sourceId: editing.source.id, validFrom: todayKey(), definition, shareLevel },
        {
          onSuccess: (id) => {
            finish(id, true);
          },
          onError: failed,
        },
      );
      return;
    }
    const existing = editing.kind === 'habit' ? editing.habit : null;
    save.mutate(
      {
        habitId: existing?.id ?? null,
        templateId: editing.kind === 'new' ? (editing.template?.id ?? null) : null,
        validFrom: todayKey(),
        definition: existing ? changedFields(existing.current, definition) : definition,
        ...(existing && existing.shareLevel === shareLevel ? {} : { shareLevel }),
      },
      {
        onSuccess: (id) => {
          finish(id, existing === null);
        },
        onError: failed,
      },
    );
  }

  return (
    <>
      <Sheet open={open && habit === null} onOpenChange={onOpenChange} title="Habit hinzufügen">
        <Library
          taken={mine.flatMap((h) => h.templateId ?? [])}
          adopted={mine.flatMap((h) => h.sourceHabitId ?? [])}
          onPick={(template) => {
            setChoice({ kind: 'new', template });
          }}
          onAdopt={(source) => {
            setChoice({ kind: 'adopt', source });
          }}
        />
      </Sheet>

      <Sheet
        fullHeight
        open={open && editing !== null}
        onOpenChange={(next) => {
          if (next) return;
          if (habit) onOpenChange(false);
          else setChoice(null);
        }}
        title={
          editing?.kind === 'habit'
            ? editing.habit.current.name
            : editing?.kind === 'adopt'
              ? `${editing.source.current.name} · von ${editing.source.ownerName}`
              : 'Neues Habit'
        }
      >
        {editing && (
          <HabitEditor
            key={
              editing.kind === 'habit'
                ? editing.habit.id
                : editing.kind === 'adopt'
                  ? `adopt-${editing.source.id}`
                  : (editing.template?.id ?? 'own')
            }
            initial={
              editing.kind === 'habit'
                ? editing.habit.current
                : editing.kind === 'adopt'
                  ? editing.source.current
                  : editing.template
                    ? { ...editing.template }
                    : EMPTY_HABIT
            }
            initialShare={editing.kind === 'habit' ? editing.habit.shareLevel : 'private'}
            isNew={editing.kind !== 'habit'}
            saving={save.isPending || adopt.isPending}
            submitLabel={submitLabel}
            actions={actions}
            onPromote={
              editing.kind === 'adopt' && isSuperAdmin
                ? () => {
                    const name = editing.source.current.name;
                    promote.mutate(editing.source.id, {
                      onSuccess: () => {
                        setChoice(null);
                        onOpenChange(false);
                        showToast(`${name} ist jetzt eine Standard-Vorlage`);
                      },
                    });
                  }
                : undefined
            }
            onSave={onSave}
            onArchive={editing.kind === 'habit' ? onArchive : undefined}
          />
        )}
      </Sheet>
    </>
  );
}

/**
 * One catalog: the standard templates and what group mates share (marked "von Grazon"),
 * each taken over with own goals.
 */
function Library({
  taken,
  adopted,
  onPick,
  onAdopt,
}: {
  taken: string[];
  adopted: string[];
  onPick: (template: HabitTemplate | null) => void;
  onAdopt: (source: CatalogHabit) => void;
}) {
  const templates = (useHabitTemplates().data ?? []).filter((t) => !taken.includes(t.id));
  const fromGroup = (useGroupCatalog().data ?? []).filter((h) => !adopted.includes(h.id));
  const entries = [
    ...templates.map((template) => ({
      key: template.id,
      name: template.name,
      line: template.description ?? summaryText(template),
      from: null as string | null,
      pick: () => {
        onPick(template);
      },
    })),
    ...fromGroup.map((habit) => ({
      key: habit.id,
      name: habit.current.name,
      line: summaryText(habit.current),
      from: habit.ownerName,
      pick: () => {
        onAdopt(habit);
      },
    })),
  ].sort((x, y) => x.name.localeCompare(y.name, 'de'));
  return (
    <div className="flex flex-col gap-3 pt-1">
      <ul className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
        {entries.map((entry) => (
          <li key={entry.key}>
            <button
              type="button"
              onClick={entry.pick}
              className="flex min-h-tap w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-3"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-subhead font-semibold">
                  {entry.name}
                  {entry.from && (
                    <span className="font-normal text-text-muted"> · von {entry.from}</span>
                  )}
                </span>
                <span className="truncate text-footnote text-text-muted">{entry.line}</span>
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
