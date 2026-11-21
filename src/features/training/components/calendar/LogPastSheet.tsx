import { useContext, useState } from 'react';
import { cn } from '@/shared/lib';
import { Button, Sheet, TextField } from '@/shared/ui';
import { useTrainingTypes } from '../../api/useCatalog';
import { useTemplates } from '../../api/useTemplates';
import { useLogPastWorkout } from '../../api/useWorkout';
import { templateSections } from '../../templateRules';
import type { TrainingType } from '../../types';
import { TrainingTypeIcon } from '../TrainingTypeIcon';
import { parseWhen, type When } from '../when';
import { WhenFields } from '../WhenFields';
import { WorkoutEditContext } from '../workout-detail/edit';

/** Default start for a day: 18:00, or an hour ago when that is still to come today. */
function defaultWhen(day: string): When {
  const now = new Date();
  const evening = new Date(`${day}T18:00:00`);
  const start = evening > now ? new Date(now.getTime() - 60 * 60 * 1000) : evening;
  const pad = (value: number) => String(value).padStart(2, '0');
  return {
    date: day,
    time: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
    minutes: '60',
  };
}

/**
 * Adds a workout afterwards for a calendar day: type, time and duration (and the details
 * of a duration type). Exercise workouts then open in the workout screen to fill in.
 */
export function LogPastSheet({
  day,
  open,
  onOpenChange,
}: {
  /** "2026-11-21" */
  day: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [type, setType] = useState<TrainingType | null>(null);
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={type ? `${type.name} nachtragen` : 'Training nachtragen'}
      className="min-h-sheet-min"
    >
      {type ? (
        <LogPastForm
          key={type.id}
          day={day}
          type={type}
          onBack={() => {
            setType(null);
          }}
          // Close without switching back to the type choice first (the sheet would change
          // height and jump); the parent mounts a fresh sheet for the next time.
          onDone={() => {
            onOpenChange(false);
          }}
        />
      ) : (
        <TypeChoice onPick={setType} />
      )}
    </Sheet>
  );
}

function TypeChoice({ onPick }: { onPick: (type: TrainingType) => void }) {
  const types = useTrainingTypes().data ?? [];
  return (
    <div className="grid grid-cols-2 gap-2">
      {types.map((type) => (
        <button
          key={type.id}
          type="button"
          onClick={() => {
            onPick(type);
          }}
          className="flex min-h-20 flex-col items-start justify-end gap-0.5 rounded-card border border-border bg-surface-2 p-4 text-left active:bg-surface-3"
        >
          <TrainingTypeIcon icon={type.icon} className="mb-1 size-6 text-accent" />
          <span className="text-body font-semibold">{type.name}</span>
        </button>
      ))}
    </div>
  );
}

function LogPastForm({
  day,
  type,
  onBack,
  onDone,
}: {
  day: string;
  type: TrainingType;
  onBack: () => void;
  onDone: () => void;
}) {
  const [when, setWhen] = useState<When>(() => defaultWhen(day));
  const [km, setKm] = useState('');
  const [note, setNote] = useState('');
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const templates = templateSections(useTemplates().data ?? [], now, type.id).active;
  const log = useLogPastWorkout();
  const editWorkout = useContext(WorkoutEditContext);
  const parsed = parseWhen(when);
  const duration = type.kind === 'duration';
  const distance = Number(km.replace(',', '.'));

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        log.mutate(
          {
            trainingTypeId: type.id,
            startedAt: parsed.start,
            durationMinutes: parsed.minutes,
            templateId: templateId ?? undefined,
            distanceKm: duration && type.withDistance && distance > 0 ? distance : undefined,
            note: duration ? note : undefined,
            variant: type.variants[0],
          },
          {
            onSuccess: (workoutId) => {
              // Exercises and sets are filled in the workout screen: go there right away.
              if (!duration) editWorkout?.(workoutId);
              onDone();
            },
          },
        );
      }}
    >
      <WhenFields value={when} onChange={setWhen} showDate={false} />

      {duration && type.withDistance && (
        <TextField
          label="Distanz (km, optional)"
          inputMode="decimal"
          value={km}
          onChange={(event) => {
            setKm(event.target.value);
          }}
        />
      )}
      {duration && (
        <TextField
          label="Notiz (optional)"
          value={note}
          maxLength={1000}
          onChange={(event) => {
            setNote(event.target.value);
          }}
        />
      )}

      {!duration && templates.length > 0 && (
        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="mb-2 text-subhead text-text-muted">Vorlage (optional)</legend>
          <div className="-mx-gutter no-scrollbar flex gap-2 overflow-x-auto px-gutter">
            {templates.map((template) => {
              const on = templateId === template.id;
              return (
                <button
                  key={template.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setTemplateId(on ? null : template.id);
                  }}
                  className={cn(
                    'flex min-h-tap shrink-0 items-center rounded-pill border px-4 text-subhead font-semibold',
                    on ? 'border-accent bg-accent text-on-accent' : 'border-border bg-surface-2',
                  )}
                >
                  {template.name}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {log.isError && (
        <p role="alert" className="text-footnote text-danger">
          Nachtragen hat nicht geklappt.
        </p>
      )}
      <Button type="submit" size="lg" missing={parsed.missing} loading={log.isPending}>
        {duration ? 'Nachtragen ✓' : 'Weiter zu den Übungen'}
      </Button>
      <Button variant="ghost" onClick={onBack}>
        Andere Trainingsart
      </Button>
    </form>
  );
}
