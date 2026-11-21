import { useState } from 'react';
import { cn } from '@/shared/lib';
import { Button, ChevronRightIcon, TextField } from '@/shared/ui';
import { useTrainingFocuses, useAllTrainingTypes } from '../../api/useCatalog';
import {
  useTemplateExerciseLists,
  useTemplateFromWorkout,
  useTemplates,
} from '../../api/useTemplates';
import { findSimilarTemplate, suggestTemplateName } from '../../templateRules';

/**
 * After a workout (summary, workout detail): keep the template list tidy.
 * - started with my template and changed it: "Vorlage aktualisieren?"
 * - started with someone else's and changed it: "Als eigene Vorlage speichern?"
 * - free workout, same exercises as one of my templates: update that one or add a new one
 * - free workout otherwise: "Als Vorlage speichern" with a suggested name
 * - a group mate's workout: "Als eigene Vorlage speichern"
 * Folded into one row with the question; a tap unfolds the options.
 */
export function SaveAsTemplate({
  workoutId,
  trainingTypeId,
  focusId,
  templateId,
  exerciseIds,
  foreign = false,
}: {
  workoutId: string;
  trainingTypeId: string;
  focusId: string | null;
  templateId: string | null;
  /** Exercises done, in order. */
  exerciseIds: string[];
  /** Someone else's workout: always becomes a new template of mine. */
  foreign?: boolean;
}) {
  const templates = useTemplates().data ?? [];
  const types = useAllTrainingTypes().data ?? [];
  const focuses = useTrainingFocuses().data ?? [];
  const save = useTemplateFromWorkout();
  const mine = templates.filter(
    (template) =>
      template.mine && !template.archivedAt && template.trainingTypeId === trainingTypeId,
  );
  const used = foreign ? null : (templates.find((template) => template.id === templateId) ?? null);
  const lists =
    useTemplateExerciseLists([...mine.map((template) => template.id), ...(used ? [used.id] : [])])
      .data ?? [];
  const typeName = types.find((type) => type.id === trainingTypeId)?.name ?? 'Training';
  const focusName = focuses.find((focus) => focus.id === focusId)?.name ?? null;
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'offer' | 'new'>('offer');
  const [open, setOpen] = useState(false);

  if (exerciseIds.length === 0) return null;
  if (save.isSuccess) {
    return <p className="text-subhead text-success">Vorlage gespeichert ✓</p>;
  }

  const usedList = used ? lists.find((list) => list.id === used.id)?.exerciseIds : undefined;
  const changed = usedList !== undefined && usedList.join(',') !== exerciseIds.join(',');
  const similarId = used
    ? null
    : findSimilarTemplate(
        exerciseIds,
        lists.filter((list) => mine.some((template) => template.id === list.id)),
      );
  const similar = mine.find((template) => template.id === similarId) ?? null;

  // Started with a template and nothing changed: nothing to ask.
  if (used && !changed) return null;

  const suggested =
    used && !used.mine ? `${used.name} (eigene)` : suggestTemplateName(focusName, typeName);
  const question =
    used?.mine && mode === 'offer'
      ? `„${used.name}“ verändert – aktualisieren?`
      : similar && mode === 'offer'
        ? `Ähnlich wie „${similar.name}“ – aktualisieren?`
        : foreign || (used && !used.mine)
          ? 'Als eigene Vorlage speichern'
          : 'Als Vorlage speichern';
  const update = (id: string) => {
    save.mutate({ workoutId, name: '', templateId: id });
  };
  const create = () => {
    save.mutate({ workoutId, name: name.trim() || suggested });
  };

  return (
    <div className="flex flex-col rounded-card bg-surface-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen((on) => !on);
        }}
        className="flex min-h-tap items-center justify-between gap-3 rounded-card px-4 py-3 text-left text-subhead active:bg-surface-3"
      >
        <span className="min-w-0">{question}</span>
        <ChevronRightIcon
          aria-hidden
          className={cn(
            'shrink-0 text-text-subtle transition-transform duration-(--duration-fast)',
            open && 'rotate-90',
          )}
        />
      </button>
      {open && (
        <div className="flex flex-col gap-2 px-4 pb-4">
          {used?.mine && mode === 'offer' ? (
            <>
              <Button
                loading={save.isPending}
                onClick={() => {
                  update(used.id);
                }}
              >
                Vorlage aktualisieren
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setMode('new');
                }}
              >
                Lieber als neue Vorlage
              </Button>
            </>
          ) : similar && mode === 'offer' ? (
            <>
              <Button
                loading={save.isPending}
                onClick={() => {
                  update(similar.id);
                }}
              >
                „{similar.name}“ aktualisieren
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setMode('new');
                }}
              >
                Neue Vorlage anlegen
              </Button>
            </>
          ) : (
            <form
              className="flex flex-col gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                create();
              }}
            >
              <TextField
                label="Name"
                placeholder={suggested}
                value={name}
                maxLength={60}
                onChange={(event) => {
                  setName(event.target.value);
                }}
              />
              <Button type="submit" loading={save.isPending}>
                Speichern
              </Button>
            </form>
          )}
          {save.isError && (
            <p role="alert" className="text-footnote text-danger">
              Speichern hat nicht geklappt.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
