import { useState } from 'react';
import { cn } from '@/shared/lib';
import { Button, FieldGroup, SegmentedControl, Switch, TextField } from '@/shared/ui';
import { useTrainingTypes } from '../../api/useCatalog';
import { useSavePlan } from '../../api/usePlans';
import { useTemplates } from '../../api/useTemplates';
import { templateSections } from '../../templateRules';
import type { PlanDraft } from '../../types';
import { TrainingTypeIcon } from '../TrainingTypeIcon';
import { isoWeekday } from './planDraft';

const WEEKDAYS = [
  { day: 1, label: 'Mo' },
  { day: 2, label: 'Di' },
  { day: 3, label: 'Mi' },
  { day: 4, label: 'Do' },
  { day: 5, label: 'Fr' },
  { day: 6, label: 'Sa' },
  { day: 7, label: 'So' },
];

const chip =
  'flex min-h-tap shrink-0 items-center gap-2 rounded-pill border px-4 text-subhead font-semibold';
const on = 'border-accent bg-accent text-on-accent';
const off = 'border-border bg-surface-2 active:bg-surface-3';

/**
 * Plan a training or an event: type (and template) or name, time, note, and optionally
 * weekly on chosen weekdays. A series is edited as a whole.
 */
export function PlanForm({ initial, onSaved }: { initial: PlanDraft; onSaved: () => void }) {
  const [draft, setDraft] = useState(initial);
  const types = useTrainingTypes().data ?? [];
  const [now] = useState(() => Date.now());
  const templates = templateSections(
    useTemplates().data ?? [],
    now,
    draft.trainingTypeId ?? '',
  ).active;
  const save = useSavePlan();
  const repeats = draft.repeatWeekdays.length > 0;
  const missing =
    draft.kind === 'training' && !draft.trainingTypeId
      ? 'Wähl eine Trainingsart.'
      : draft.kind === 'event' && !draft.title.trim()
        ? 'Gib dem Event einen Namen.'
        : null;

  function set(changes: Partial<PlanDraft>) {
    setDraft((current) => ({ ...current, ...changes }));
  }

  return (
    <form
      className="flex flex-col gap-6 pt-1"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate(draft, { onSuccess: onSaved });
      }}
    >
      <SegmentedControl
        label="Art des Termins"
        value={draft.kind}
        onChange={(kind) => {
          set({ kind });
        }}
        options={[
          { value: 'training', label: 'Training' },
          { value: 'event', label: 'Event' },
        ]}
      />

      {draft.kind === 'training' ? (
        <>
          <FieldGroup label="Trainingsart">
            <div className="-mx-gutter no-scrollbar flex gap-2 overflow-x-auto px-gutter">
              {types.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  aria-pressed={draft.trainingTypeId === type.id}
                  onClick={() => {
                    set({ trainingTypeId: type.id, templateId: null });
                  }}
                  className={cn(chip, draft.trainingTypeId === type.id ? on : off)}
                >
                  <TrainingTypeIcon icon={type.icon} className="size-4" />
                  {type.name}
                </button>
              ))}
            </div>
          </FieldGroup>
          {templates.length > 0 && (
            <FieldGroup label="Vorlage (optional)">
              <div className="-mx-gutter no-scrollbar flex gap-2 overflow-x-auto px-gutter">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    aria-pressed={draft.templateId === template.id}
                    onClick={() => {
                      set({ templateId: draft.templateId === template.id ? null : template.id });
                    }}
                    className={cn(chip, draft.templateId === template.id ? on : off)}
                  >
                    {template.name}
                  </button>
                ))}
              </div>
            </FieldGroup>
          )}
        </>
      ) : (
        <TextField
          label="Name"
          placeholder="z. B. Stadtlauf, Grillen"
          value={draft.title}
          maxLength={60}
          onChange={(event) => {
            set({ title: event.target.value });
          }}
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Tag"
          type="date"
          className="h-tap appearance-none"
          value={draft.startsOn}
          onChange={(event) => {
            set({ startsOn: event.target.value });
          }}
        />
        <TextField
          label="Uhrzeit (optional)"
          type="time"
          className="h-tap appearance-none"
          value={draft.startTime}
          onChange={(event) => {
            set({ startTime: event.target.value });
          }}
        />
      </div>

      <div className="flex flex-col gap-3">
        <Switch
          label="Wöchentlich wiederholen"
          checked={repeats}
          onCheckedChange={(repeat) => {
            set({ repeatWeekdays: repeat ? [isoWeekday(draft.startsOn)] : [], repeatUntil: '' });
          }}
        />
        {repeats && (
          <>
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map(({ day, label }) => {
                const active = draft.repeatWeekdays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      const next = active
                        ? draft.repeatWeekdays.filter((d) => d !== day)
                        : [...draft.repeatWeekdays, day].sort();
                      // At least one day stays chosen while repeating.
                      if (next.length > 0) set({ repeatWeekdays: next });
                    }}
                    className={cn(
                      'flex min-h-tap items-center justify-center rounded-pill border text-footnote font-semibold',
                      active ? on : off,
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <TextField
              label="Bis (optional)"
              type="date"
              className="h-tap appearance-none"
              min={draft.startsOn}
              value={draft.repeatUntil}
              onChange={(event) => {
                set({ repeatUntil: event.target.value });
              }}
            />
          </>
        )}
      </div>

      <TextField
        label="Notiz (optional)"
        value={draft.note}
        maxLength={500}
        onChange={(event) => {
          set({ note: event.target.value });
        }}
      />

      {save.isError && (
        <p role="alert" className="text-footnote text-danger">
          Speichern hat nicht geklappt.
        </p>
      )}
      <Button type="submit" size="lg" missing={missing} loading={save.isPending}>
        {draft.id ? 'Speichern' : 'Planen'}
      </Button>
    </form>
  );
}
