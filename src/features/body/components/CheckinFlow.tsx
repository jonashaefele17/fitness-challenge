import { useState } from 'react';
import { cn, showToast } from '@/shared/lib';
import { Button, ChevronLeftIcon, ChevronRightIcon, NumberWheel, Sheet } from '@/shared/ui';
import {
  useCheckins,
  useDeleteCheckin,
  useMeasurementKinds,
  useRestoreCheckin,
  useSaveCheckin,
} from '../api/useCheckins';
import { useBodySettings } from '../api/useWeight';
import { checkinOn, formatCm, formatSignedCm, newCheckin, parseCm } from '../checkin';
import {
  answersChanged,
  checkinSteps,
  checkinValues,
  initialAnswers,
  measureSteps,
  previousValues,
  stepResult,
  suggestedValues,
  summaryRows,
  wheelValue,
  type CheckinAnswers,
  type CheckinStep,
  type SuggestedValue,
} from '../checkinFlow';
import { todayKey } from '../format';
import type { BodyCheckin, MeasurementKind } from '../types';

const shortDate = new Intl.DateTimeFormat('de', { day: 'numeric', month: 'short' });
const withYear = new Intl.DateTimeFormat('de', { day: 'numeric', month: 'short', year: 'numeric' });
const longDate = new Intl.DateTimeFormat('de', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const date = (day: string) => new Date(`${day}T12:00:00`);

function dayText(day: string, today: string): string {
  if (day === today) return 'Heute';
  return (day.slice(0, 4) === today.slice(0, 4) ? shortDate : withYear).format(date(day));
}

/**
 * The Zwischenstand: one measurement per screen (my visible kinds in catalogue order), then
 * a summary to save. New ones are for today; the date in the header picks another day to
 * fill in later. An existing one opens at its summary to change or delete it. Saving closes
 * at once with "Rückgängig"; closing with something entered asks before throwing it away.
 */
export function CheckinFlow({
  open,
  onOpenChange,
  checkin = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** An existing check-in to change (or delete); null: a new one. */
  checkin?: BodyCheckin | null;
}) {
  // The mutations live here, outside the sheet's content, so "Rückgängig" still works after
  // the sheet has closed.
  const save = useSaveCheckin();
  const remove = useDeleteCheckin();
  const restore = useRestoreCheckin();
  const kinds = useMeasurementKinds().data;
  const settings = useBodySettings().data;
  const checkins = useCheckins().data ?? [];
  const [today] = useState(todayKey);

  // A fresh start each time it opens (state adjusted while rendering).
  const [wasOpen, setWasOpen] = useState(false);
  const [index, setIndex] = useState<number | null>(null);
  const [changes, setChanges] = useState<CheckinAnswers>({});
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setIndex(null);
      setChanges({});
      setPickedDay(null);
      setConfirming(false);
    }
  }

  const steps: CheckinStep[] = kinds
    ? checkinSteps(kinds, settings?.hiddenMeasurementKinds ?? [])
    : [];
  const summaryIndex = steps.findIndex((s) => s.type === 'summary');
  const initial = initialAnswers(checkin, steps);
  const answers = { ...initial, ...changes };
  const onDate = checkin?.onDate ?? pickedDay ?? today;
  // A check-in with values opens at its summary; a new or skipped one at the first step.
  const current = index ?? (checkin && Object.keys(checkin.values).length > 0 ? summaryIndex : 0);
  const step = steps[current];
  const dirty = answersChanged(initial, answers);

  function requestClose() {
    if (dirty) setConfirming(true);
    else onOpenChange(false);
  }

  function saveCheckin() {
    const values = checkinValues(steps, answers, checkin);
    const { input, previous } = newCheckin(checkins, onDate, values);
    onOpenChange(false);
    save.mutate(input, {
      onError: () => {
        showToast('Zwischenstand konnte nicht gespeichert werden.');
      },
    });
    showToast('Zwischenstand gespeichert', {
      label: 'Rückgängig',
      onAction: () => {
        if (previous) restore.mutate(previous);
        else remove.mutate(input.id);
      },
    });
  }

  function deleteCheckin(target: BodyCheckin) {
    onOpenChange(false);
    remove.mutate(target.id, {
      onError: () => {
        showToast('Zwischenstand konnte nicht gelöscht werden.');
      },
    });
    showToast('Zwischenstand gelöscht', {
      label: 'Rückgängig',
      onAction: () => {
        restore.mutate(target);
      },
    });
  }

  const measures = measureSteps(steps);
  const replaces = !checkin && checkinOn(checkins, onDate)?.skipped === false;

  return (
    <>
      <Sheet
        fullHeight
        open={open && !confirming}
        onOpenChange={(next) => {
          if (!next) requestClose();
        }}
        title="Zwischenstand"
        action={
          checkin ? (
            <span className="text-subhead text-text-muted">{dayText(onDate, today)}</span>
          ) : (
            <DayPicker
              day={onDate}
              today={today}
              onChange={(day) => {
                setPickedDay(day);
              }}
            />
          )
        }
        // One height for every screen: the sheet does not jump between them.
        className="min-h-sheet-min"
      >
        {step?.type === 'measure' && (
          <MeasureStep
            key={step.kind.key}
            kind={step.kind}
            position={measures.indexOf(step.kind) + 1}
            count={measures.length}
            answer={answers[step.kind.key]}
            suggestion={suggestedValues(checkins, onDate)[step.kind.key]}
            today={today}
            isLast={steps[current + 1]?.type === 'summary'}
            onBack={
              current > 0
                ? () => {
                    setIndex(current - 1);
                  }
                : undefined
            }
            onChange={(value) => {
              setChanges((c) => ({ ...c, [step.kind.key]: value }));
            }}
            onLeave={(value) => {
              setChanges((c) => ({ ...c, [step.kind.key]: value }));
              setIndex(current + 1);
            }}
          />
        )}
        {step?.type === 'summary' && (
          <Summary
            rows={summaryRows(steps, answers, previousValues(checkins, onDate))}
            dayLine={longDate.format(date(onDate))}
            replaces={replaces}
            onBack={
              current > 0
                ? () => {
                    setIndex(current - 1);
                  }
                : undefined
            }
            onEdit={(kind) => {
              setIndex(steps.findIndex((s) => s.type === 'measure' && s.kind.key === kind.key));
            }}
            canSave={Object.keys(checkinValues(steps, answers, checkin)).length > 0}
            onSave={saveCheckin}
            onDelete={
              checkin
                ? () => {
                    deleteCheckin(checkin);
                  }
                : undefined
            }
          />
        )}
      </Sheet>

      <Sheet
        open={open && confirming}
        onOpenChange={(next) => {
          if (!next) setConfirming(false);
        }}
        title="Zwischenstand verwerfen?"
        description="Die Maße, die du eingegeben hast, werden nicht gespeichert."
      >
        <div className="flex flex-col gap-2">
          <Button
            variant="danger"
            fullWidth
            onClick={() => {
              setConfirming(false);
              onOpenChange(false);
            }}
          >
            Verwerfen
          </Button>
          <Button
            variant="ghost"
            fullWidth
            onClick={() => {
              setConfirming(false);
            }}
          >
            Weiter messen
          </Button>
        </div>
      </Sheet>
    </>
  );
}

/** The day in the header; a tap picks another one (today or earlier) to fill in later. */
function DayPicker({
  day,
  today,
  onChange,
}: {
  day: string;
  today: string;
  onChange: (day: string) => void;
}) {
  return (
    <label className="relative flex min-h-tap items-center gap-0.5 rounded-pill pr-1 pl-3 text-subhead font-semibold text-accent active:bg-surface-2">
      {dayText(day, today)}
      <ChevronRightIcon aria-hidden className="size-4 rotate-90" />
      <input
        type="date"
        aria-label="Tag des Zwischenstands"
        value={day}
        max={today}
        onClick={(event) => {
          try {
            event.currentTarget.showPicker();
          } catch {
            // Older browsers open their picker on their own.
          }
        }}
        onChange={(event) => {
          const next = event.target.value;
          if (next && next <= today) onChange(next);
        }}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </label>
  );
}

function StepHeader({
  onBack,
  counter,
}: {
  onBack: (() => void) | undefined;
  counter: string | null;
}) {
  return (
    <div className="flex min-h-tap items-center justify-between">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="-ml-2 flex min-h-tap items-center gap-1 rounded-pill px-2 text-subhead font-semibold text-accent active:bg-surface-2"
        >
          <ChevronLeftIcon aria-hidden /> Zurück
        </button>
      ) : (
        <span />
      )}
      {counter && <span className="text-footnote text-text-muted">{counter}</span>}
    </div>
  );
}

function MeasureStep({
  kind,
  position,
  count,
  answer,
  suggestion,
  today,
  isLast,
  onBack,
  onChange,
  onLeave,
}: {
  kind: MeasurementKind;
  position: number;
  count: number;
  answer: number | null | undefined;
  suggestion: SuggestedValue | undefined;
  today: string;
  isLast: boolean;
  onBack: (() => void) | undefined;
  onChange: (value: number) => void;
  /** Leaves the screen with this value (null: left out). */
  onLeave: (value: number | null) => void;
}) {
  const shown = wheelValue(answer, suggestion?.value);
  return (
    <div className="flex min-h-sheet-min flex-col gap-6 pt-1">
      <div className="flex flex-col gap-1">
        <StepHeader onBack={onBack} counter={`${String(position)} von ${String(count)}`} />
        <h3 className="text-title-1 font-bold">{kind.label}</h3>
        <p className="text-subhead text-text-muted">{kind.hint}</p>
      </div>
      <div className="flex flex-col items-center gap-1 rounded-card bg-surface-2 py-3">
        <span className="text-footnote text-text-muted">
          {kind.label} in {kind.unit}
        </span>
        <NumberWheel
          value={shown.value}
          suggested={shown.suggested}
          step={kind.step}
          emptyStart={kind.startValue}
          label={`${kind.label} in ${kind.unit}`}
          format={formatCm}
          parse={(text) => parseCm(text) ?? Number.NaN}
          onChange={(next) => {
            // The wheel can roll past what a body measures; keep the last valid value.
            if (parseCm(String(next)) !== null) onChange(next);
          }}
        />
        {/* Always one line, so the wheel does not move when the text goes. */}
        <span className="min-h-5 text-footnote text-text-subtle">
          {shown.value === null
            ? 'Antippen und Wert eingeben'
            : shown.suggested && suggestion
              ? `Zuletzt am ${dayText(suggestion.onDate, today)}`
              : ''}
        </span>
      </div>
      <div className="mt-auto flex flex-col gap-2 pb-2">
        <Button
          size="lg"
          onClick={() => {
            onLeave(stepResult(answer, suggestion?.value, 'next'));
          }}
        >
          {isLast ? 'Fertig' : 'Weiter'}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            onLeave(stepResult(answer, suggestion?.value, 'skip'));
          }}
        >
          Überspringen
        </Button>
      </div>
    </div>
  );
}

function Summary({
  rows,
  dayLine,
  replaces,
  onBack,
  onEdit,
  canSave,
  onSave,
  onDelete,
}: {
  rows: ReturnType<typeof summaryRows>;
  dayLine: string;
  replaces: boolean;
  onBack: (() => void) | undefined;
  onEdit: (kind: MeasurementKind) => void;
  canSave: boolean;
  onSave: () => void;
  onDelete: (() => void) | undefined;
}) {
  return (
    <div className="flex min-h-sheet-min flex-col gap-5 pt-1">
      <div className="flex flex-col gap-1">
        <StepHeader onBack={onBack} counter={null} />
        <h3 className="text-title-2 font-bold">Übersicht</h3>
        <p className="text-subhead text-text-muted">{dayLine}</p>
      </div>
      <ul className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
        {rows.map((row) => (
          <li key={row.kind.key}>
            <button
              type="button"
              onClick={() => {
                onEdit(row.kind);
              }}
              className="flex min-h-tap w-full items-center gap-3 px-4 py-2 text-left active:bg-surface-3"
            >
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-body',
                  row.value === null && 'text-text-muted',
                )}
              >
                {row.kind.label}
              </span>
              {row.value === null ? (
                <span className="text-subhead text-text-subtle">übersprungen</span>
              ) : (
                <span className="flex flex-col items-end">
                  <span className="text-body font-semibold tabular-nums">
                    {formatCm(row.value)} {row.kind.unit}
                  </span>
                  {row.change !== null && (
                    <span className="text-footnote text-text-muted tabular-nums">
                      {formatSignedCm(row.change)}
                    </span>
                  )}
                </span>
              )}
              <ChevronRightIcon aria-hidden className="shrink-0 text-text-subtle" />
            </button>
          </li>
        ))}
      </ul>
      {replaces && (
        <p className="text-footnote text-text-subtle">
          An diesem Tag gibt es schon einen Zwischenstand. Er wird ersetzt.
        </p>
      )}
      <div className="mt-auto flex flex-col gap-2 pb-2">
        <Button
          size="lg"
          missing={canSave ? null : 'Trag mindestens ein Maß ein.'}
          onClick={onSave}
        >
          Speichern
        </Button>
        {onDelete && (
          <Button variant="danger" fullWidth onClick={onDelete}>
            Zwischenstand löschen
          </Button>
        )}
      </div>
    </div>
  );
}
