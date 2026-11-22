import { useState } from 'react';
import { cn } from '@/shared/lib';
import { ChevronDownIcon } from '@/shared/ui';
import { useTemplateItems, useTemplateNames } from '../../api/useTemplates';
import type { TemplateItem } from '../../types';

/** "3 × 8–10", "2 W + 3 × 8–10", "3 × 0:45" */
function setsText(item: TemplateItem): string {
  const reps =
    item.durationSeconds !== null
      ? `${String(Math.floor(item.durationSeconds / 60))}:${String(item.durationSeconds % 60).padStart(2, '0')}`
      : item.repMin !== null && item.repMax !== null && item.repMin !== item.repMax
        ? `${String(item.repMin)}–${String(item.repMax)}`
        : item.repMin !== null || item.repMax !== null
          ? String(item.repMin ?? item.repMax)
          : null;
  const working = reps ? `${String(item.sets)} × ${reps}` : `${String(item.sets)} Sätze`;
  return item.warmupSets > 0 ? `${String(item.warmupSets)} W + ${working}` : working;
}

/**
 * "Was erwartet mich?": the templates chosen for a date, each with its exercises, sets and
 * rep ranges – also when they belong to someone else in the group.
 */
export function PlanTemplates({ templateIds }: { templateIds: string[] }) {
  const names = useTemplateNames(templateIds).data ?? [];
  if (templateIds.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-footnote font-semibold text-text-muted">
        {templateIds.length === 1 ? 'Vorlage' : 'Vorlagen zur Auswahl'}
      </h3>
      <ul className="flex flex-col gap-2">
        {templateIds.map((id, index) => (
          <li key={id}>
            <TemplateCard
              templateId={id}
              name={names.find((n) => n.id === id)?.name ?? 'Vorlage'}
              initiallyOpen={index === 0}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function TemplateCard({
  templateId,
  name,
  initiallyOpen,
}: {
  templateId: string;
  name: string;
  initiallyOpen: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const items = useTemplateItems(templateId).data ?? [];
  const sets = items.reduce((sum, item) => sum + item.sets, 0);
  return (
    <div className="rounded-card bg-surface-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
        }}
        className="flex min-h-tap w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-subhead font-semibold">{name}</span>
          <span className="text-footnote text-text-muted">
            {items.length} {items.length === 1 ? 'Übung' : 'Übungen'} · {sets} Sätze
          </span>
        </span>
        <ChevronDownIcon
          aria-hidden
          className={cn('shrink-0 text-text-subtle transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && items.length > 0 && (
        <ol className="flex flex-col divide-y divide-border border-t border-border">
          {items.map((item, index) => (
            <li
              key={`${item.exercise.id}-${String(index)}`}
              className="flex items-baseline justify-between gap-3 px-4 py-2.5"
            >
              <span className="min-w-0 truncate text-subhead">{item.exercise.name}</span>
              <span className="shrink-0 text-footnote text-text-muted tabular-nums">
                {setsText(item)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
