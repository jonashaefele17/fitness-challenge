import { useState } from 'react';
import { formatRelativeTime } from '@/shared/lib';
import { Button, ChevronRightIcon, Sheet } from '@/shared/ui';
import { useAllTrainingTypes, useTrainingTypes } from '../../api/useCatalog';
import {
  useArchiveTemplate,
  useCopyTemplate,
  useDeleteTemplate,
  useTemplateItems,
  useTemplates,
} from '../../api/useTemplates';
import { useStartWorkout } from '../../api/useWorkout';
import { templateSections, TOP_COUNT } from '../../templateRules';
import type { TemplateDraft, TemplateSummary } from '../../types';
import { TrainingTypeIcon } from '../TrainingTypeIcon';
import { FocusPill } from './FocusPill';
import { TemplateEditor } from './TemplateEditor';
import { itemPlan } from './templateText';

type Editing = { draft: TemplateDraft } | null;

/**
 * "Training → Vorlagen": my templates (most recently used first), long-unused ones and
 * group mates' active ones folded away, the archive at the end.
 */
export function TemplatesView({ onStarted }: { onStarted: () => void }) {
  const templates = useTemplates();
  const types = useTrainingTypes().data ?? [];
  const [now] = useState(() => Date.now());
  const [showAll, setShowAll] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const sections = templateSections(templates.data ?? [], now);
  const studio = types.find((type) => type.kind === 'exercises');
  const open = (templates.data ?? []).find((template) => template.id === openId) ?? null;

  function newTemplate() {
    if (!studio) return;
    setEditing({
      draft: { id: null, name: '', trainingTypeId: studio.id, focusId: null, note: '', items: [] },
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {!templates.isPending && sections.active.length === 0 && (
        <p className="text-footnote text-text-subtle">
          Noch keine Vorlagen. Leg eine an oder speichere ein abgeschlossenes Training als Vorlage.
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {(showAll ? sections.active : sections.active.slice(0, TOP_COUNT)).map((template) => (
          <TemplateCard key={template.id} template={template} onOpen={setOpenId} />
        ))}
      </ul>
      {!showAll && sections.active.length > TOP_COUNT && (
        <Button
          variant="ghost"
          onClick={() => {
            setShowAll(true);
          }}
        >
          Alle Vorlagen ({sections.active.length})
        </Button>
      )}
      <Button variant="secondary" onClick={newTemplate}>
        + Neue Vorlage
      </Button>

      <Folded title="Von der Gruppe" templates={sections.group} onOpen={setOpenId} />
      <Folded title="Lange nicht genutzt" templates={sections.stale} onOpen={setOpenId} />
      <Folded title="Archiv" templates={sections.archived} onOpen={setOpenId} />

      <TemplateSheet
        template={open}
        onClose={() => {
          setOpenId(null);
        }}
        onEdit={(draft) => {
          setOpenId(null);
          setEditing({ draft });
        }}
        onStarted={onStarted}
      />

      <Sheet
        fullHeight
        open={editing !== null}
        onOpenChange={(next) => {
          if (!next) setEditing(null);
        }}
        title={editing?.draft.id ? 'Vorlage bearbeiten' : 'Neue Vorlage'}
        className="min-h-sheet-min"
      >
        {editing && (
          <TemplateEditor
            key={editing.draft.id ?? 'new'}
            initial={editing.draft}
            onSaved={() => {
              setEditing(null);
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

function Folded({
  title,
  templates,
  onOpen,
}: {
  title: string;
  templates: TemplateSummary[];
  onOpen: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  if (templates.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen((on) => !on);
        }}
        className="flex min-h-tap items-center justify-between text-subhead font-semibold text-text-muted"
      >
        {title} ({templates.length})
        <ChevronRightIcon
          aria-hidden
          className={open ? 'rotate-90 transition-transform' : 'transition-transform'}
        />
      </button>
      {open && (
        <ul className="flex flex-col gap-2">
          {templates.map((template) => (
            <TemplateCard key={template.id} template={template} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </section>
  );
}

function TemplateCard({
  template,
  onOpen,
}: {
  template: TemplateSummary;
  onOpen: (id: string) => void;
}) {
  const type = (useAllTrainingTypes().data ?? []).find((t) => t.id === template.trainingTypeId);
  const parts = [
    template.exerciseCount === 1 ? '1 Übung' : `${String(template.exerciseCount)} Übungen`,
    template.mine ? null : `von ${template.ownerName ?? '…'}`,
    template.myLastUsedAt ? `zuletzt ${formatRelativeTime(template.myLastUsedAt)}` : null,
  ].filter(Boolean);
  return (
    <li>
      <button
        type="button"
        onClick={() => {
          onOpen(template.id);
        }}
        className="flex min-h-tap w-full items-center gap-3 rounded-card bg-surface-2 px-4 py-3 text-left active:bg-surface-3"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-surface-3 text-accent">
          <TrainingTypeIcon icon={type?.icon ?? 'generic'} className="size-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-subhead font-semibold">{template.name}</span>
            <FocusPill focusId={template.focusId} />
          </span>
          <span className="truncate text-footnote text-text-muted">{parts.join(' · ')}</span>
        </span>
        <ChevronRightIcon aria-hidden className="shrink-0 text-text-subtle" />
      </button>
    </li>
  );
}

function TemplateSheet({
  template,
  onClose,
  onEdit,
  onStarted,
}: {
  template: TemplateSummary | null;
  onClose: () => void;
  onEdit: (draft: TemplateDraft) => void;
  onStarted: () => void;
}) {
  const items = useTemplateItems(template?.id ?? null).data ?? [];
  const start = useStartWorkout();
  const copy = useCopyTemplate();
  const archive = useArchiveTemplate();
  const remove = useDeleteTemplate();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function close() {
    setConfirmDelete(false);
    onClose();
  }

  return (
    <Sheet
      open={template !== null}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      title={template?.name ?? 'Vorlage'}
      {...(template && !template.mine && template.ownerName
        ? { description: `Vorlage von ${template.ownerName}` }
        : {})}
      className="min-h-sheet-min"
    >
      {template && (
        <div className="flex flex-col gap-4">
          <ul className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
            {items.map((item) => (
              <li
                key={item.exercise.id}
                className="flex items-baseline justify-between gap-3 px-4 py-2.5"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-subhead">{item.exercise.name}</span>
                  {item.deviceType && (
                    <span className="truncate text-footnote text-text-subtle">
                      {item.deviceType.name}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-footnote text-text-muted tabular-nums">
                  {itemPlan(item)}
                </span>
              </li>
            ))}
          </ul>
          {template.note && <p className="text-subhead text-text-muted">{template.note}</p>}

          {!template.archivedAt && (
            <Button
              size="lg"
              loading={start.isPending}
              onClick={() => {
                start.mutate(
                  { trainingTypeId: template.trainingTypeId, templateId: template.id },
                  {
                    onSuccess: () => {
                      close();
                      onStarted();
                    },
                  },
                );
              }}
            >
              Training starten
            </Button>
          )}
          {start.isError && (
            <p role="alert" className="text-footnote text-danger">
              Starten hat nicht geklappt (läuft schon ein Training?).
            </p>
          )}

          {template.mine ? (
            <>
              {!template.archivedAt && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    onEdit({
                      id: template.id,
                      name: template.name,
                      trainingTypeId: template.trainingTypeId,
                      focusId: template.focusId,
                      note: template.note ?? '',
                      items,
                    });
                  }}
                >
                  Bearbeiten
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={() => {
                  archive.mutate({ id: template.id, archived: !template.archivedAt });
                  close();
                }}
              >
                {template.archivedAt ? 'Zurückholen' : 'Archivieren'}
              </Button>
              {template.archivedAt &&
                (confirmDelete ? (
                  <div className="flex flex-col gap-2 rounded-card bg-surface-2 p-4">
                    <p className="text-subhead">
                      Endgültig löschen? Trainings mit dieser Vorlage bleiben erhalten.
                    </p>
                    <Button
                      variant="danger"
                      loading={remove.isPending}
                      onClick={() => {
                        remove.mutate(template.id, { onSuccess: close });
                      }}
                    >
                      Ja, löschen
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setConfirmDelete(true);
                    }}
                  >
                    Endgültig löschen
                  </Button>
                ))}
            </>
          ) : (
            <Button
              variant="secondary"
              loading={copy.isPending}
              onClick={() => {
                copy.mutate(template.id, { onSuccess: close });
              }}
            >
              Als eigene kopieren
            </Button>
          )}
        </div>
      )}
    </Sheet>
  );
}
