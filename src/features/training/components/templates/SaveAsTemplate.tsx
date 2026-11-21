import { useState } from 'react';
import { Button, TextField } from '@/shared/ui';
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
 */
export function SaveAsTemplate({
  workoutId,
  trainingTypeId,
  focusId,
  templateId,
  exerciseIds,
}: {
  workoutId: string;
  trainingTypeId: string;
  focusId: string | null;
  templateId: string | null;
  /** Exercises done, in order. */
  exerciseIds: string[];
}) {
  const templates = useTemplates().data ?? [];
  const types = useAllTrainingTypes().data ?? [];
  const focuses = useTrainingFocuses().data ?? [];
  const save = useTemplateFromWorkout();
  const mine = templates.filter(
    (template) =>
      template.mine && !template.archivedAt && template.trainingTypeId === trainingTypeId,
  );
  const used = templates.find((template) => template.id === templateId) ?? null;
  const lists =
    useTemplateExerciseLists([...mine.map((template) => template.id), ...(used ? [used.id] : [])])
      .data ?? [];
  const typeName = types.find((type) => type.id === trainingTypeId)?.name ?? 'Training';
  const focusName = focuses.find((focus) => focus.id === focusId)?.name ?? null;
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'offer' | 'new'>('offer');

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
  const update = (id: string) => {
    save.mutate({ workoutId, name: '', templateId: id });
  };
  const create = () => {
    save.mutate({ workoutId, name: name.trim() || suggested });
  };

  return (
    <div className="flex flex-col gap-2 rounded-card bg-surface-2 p-4">
      {used?.mine && mode === 'offer' ? (
        <>
          <p className="text-subhead">Du hast „{used.name}“ verändert. Vorlage aktualisieren?</p>
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
          <p className="text-subhead">Ähnlich wie „{similar.name}“. Diese aktualisieren?</p>
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
          <p className="text-subhead">
            {used && !used.mine ? 'Als eigene Vorlage speichern?' : 'Als Vorlage speichern?'}
          </p>
          <TextField
            label="Name"
            placeholder={suggested}
            value={name}
            maxLength={60}
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
          <Button type="submit" variant="secondary" loading={save.isPending}>
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
  );
}
