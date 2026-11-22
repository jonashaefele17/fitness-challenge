import { useState } from 'react';
import { cn } from '@/shared/lib';
import { FieldGroup } from '@/shared/ui';
import { useAllTrainingTypes, useTrainingFocuses } from '../../api/useCatalog';
import { useTemplates } from '../../api/useTemplates';
import { templateSections } from '../../templateRules';

const chip =
  'flex min-h-tap shrink-0 items-center gap-2 rounded-pill border px-4 text-subhead font-semibold';
const on = 'border-accent bg-accent text-on-accent';
const off = 'border-border bg-surface-2 active:bg-surface-3';

export interface PlanTarget {
  focusId: string | null;
  templateIds: string[];
}

/**
 * What a planned training is about: its focus (what the overview shows) and the templates
 * to choose from at the start (several, so the same day need not always be the same
 * workout). Templates with the chosen focus come first; picking a template first takes over
 * its focus.
 */
export function PlanTargetPicker({
  trainingTypeId,
  value,
  onChange,
}: {
  trainingTypeId: string | null;
  value: PlanTarget;
  onChange: (value: PlanTarget) => void;
}) {
  const type = (useAllTrainingTypes().data ?? []).find((t) => t.id === trainingTypeId);
  const focuses = (useTrainingFocuses().data ?? []).filter(
    (focus) => !type?.focusIds || type.focusIds.includes(focus.id),
  );
  const [now] = useState(() => Date.now());
  const allTemplates = useTemplates().data ?? [];
  const templates = trainingTypeId
    ? templateSections(allTemplates, now, trainingTypeId).active
    : [];
  const matching = value.focusId ? templates.filter((t) => t.focusId === value.focusId) : templates;
  const others = value.focusId ? templates.filter((t) => t.focusId !== value.focusId) : [];

  function toggleTemplate(id: string) {
    const chosen = value.templateIds.includes(id);
    const templateIds = chosen
      ? value.templateIds.filter((t) => t !== id)
      : [...value.templateIds, id];
    // Picking a template first: its focus becomes the plan's.
    const template = templates.find((t) => t.id === id);
    const focusId = value.focusId ?? (chosen ? null : (template?.focusId ?? null));
    onChange({ focusId, templateIds });
  }

  const templateChip = (template: (typeof templates)[number], quiet: boolean) => {
    const chosen = value.templateIds.includes(template.id);
    return (
      <button
        key={template.id}
        type="button"
        aria-pressed={chosen}
        onClick={() => {
          toggleTemplate(template.id);
        }}
        className={cn(chip, chosen ? on : off, !chosen && quiet && 'text-text-muted')}
      >
        {template.name}
      </button>
    );
  };

  return (
    <>
      {focuses.length > 0 && (
        <FieldGroup label="Fokus (optional)">
          <div className="-mx-gutter no-scrollbar flex gap-2 overflow-x-auto px-gutter">
            {focuses.map((focus) => {
              const chosen = value.focusId === focus.id;
              return (
                <button
                  key={focus.id}
                  type="button"
                  aria-pressed={chosen}
                  onClick={() => {
                    const focusId = chosen ? null : focus.id;
                    // A new focus keeps only the templates that fit it (or have no focus).
                    const templateIds = focusId
                      ? value.templateIds.filter((id) => {
                          const template = templates.find((t) => t.id === id);
                          return !template?.focusId || template.focusId === focusId;
                        })
                      : value.templateIds;
                    onChange({ focusId, templateIds });
                  }}
                  className={cn(chip, chosen ? on : off)}
                >
                  {focus.name}
                </button>
              );
            })}
          </div>
        </FieldGroup>
      )}
      {/* Always there (same height), so the sheet does not jump when the type changes. */}
      <FieldGroup label="Vorlagen (optional, mehrere zur Auswahl beim Start)">
        {templates.length > 0 ? (
          <div className="-mx-gutter no-scrollbar flex items-center gap-2 overflow-x-auto px-gutter">
            {matching.map((template) => templateChip(template, false))}
            {others.length > 0 && (
              <>
                <span className="shrink-0 px-1 text-footnote text-text-subtle">
                  {matching.length > 0 ? 'Andere' : 'Keine mit diesem Fokus · Andere'}
                </span>
                {others.map((template) => templateChip(template, true))}
              </>
            )}
          </div>
        ) : (
          <p className="flex min-h-tap items-center text-subhead text-text-subtle">
            {trainingTypeId
              ? 'Keine Vorlagen für diese Trainingsart.'
              : 'Erst eine Trainingsart wählen.'}
          </p>
        )}
      </FieldGroup>
    </>
  );
}
