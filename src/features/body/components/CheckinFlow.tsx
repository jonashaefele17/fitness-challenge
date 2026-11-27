import { useRef, useState } from 'react';
import { cn, showToast } from '@/shared/lib';
import { Button, ChevronRightIcon, NumberWheel, Sheet } from '@/shared/ui';
import {
  useCheckins,
  useDeleteCheckin,
  useMeasurementKinds,
  useRestoreCheckin,
  useSaveCheckin,
} from '../api/useCheckins';
import { useAddBodyPhoto, useDeleteBodyPhoto, usePhotoPoses } from '../api/usePhotos';
import { useBodySettings } from '../api/useWeight';
import { checkinOn, formatCm, formatSignedCm, newCheckin, parseCm } from '../checkin';
import {
  answersChanged,
  canSaveCheckin,
  checkinSteps,
  checkinValues,
  initialAnswers,
  measureSteps,
  photoPlan,
  previousValues,
  stepResult,
  suggestedValues,
  summaryRows,
  wheelValue,
  type CheckinAnswers,
  type PhotoAnswers,
  type SuggestedValue,
} from '../checkinFlow';
import { todayKey } from '../format';
import { previousPosePhotos, shownPhotos, type ShownPhoto } from '../photoView';
import type { BodyCheckin, MeasurementKind } from '../types';
import { CheckinPhotoStep } from './CheckinPhotoStep';
import { CheckinStepHeader } from './CheckinStepHeader';
import { BlobImage, StoredImage } from './PhotoImage';

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
 * The Zwischenstand: one measurement per screen (my visible kinds in catalogue order), the
 * photos (Vorne, Seite, Hinten), then a summary to save. New pictures upload after saving
 * (the sheet waits and shows the progress; a failed one is reported, the check-in stays). New ones are for today; the date in the header picks another day to
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
  const addPhoto = useAddBodyPhoto();
  const deletePhoto = useDeleteBodyPhoto();
  const kinds = useMeasurementKinds().data;
  const poses = usePhotoPoses().data;
  const settings = useBodySettings().data;
  const checkins = useCheckins().data ?? [];
  const [today] = useState(todayKey);

  // A fresh start each time it opens (state adjusted while rendering).
  const [wasOpen, setWasOpen] = useState(false);
  const [index, setIndex] = useState<number | null>(null);
  const [changes, setChanges] = useState<CheckinAnswers>({});
  const [photoChanges, setPhotoChanges] = useState<PhotoAnswers>({});
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  /** Photos being uploaded after saving (the sheet waits for them). */
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  // Closed while uploading (the upload goes on): it must not close a flow opened again since.
  const closedWhileUploading = useRef(false);
  const wasClosedWhileUploading = () => closedWhileUploading.current;
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setIndex(null);
      setChanges({});
      setPhotoChanges({});
      setPickedDay(null);
      setConfirming(false);
    }
  }

  const steps = kinds && poses ? checkinSteps(kinds, settings?.hiddenMeasurementKinds ?? []) : [];
  const summaryIndex = steps.findIndex((s) => s.type === 'summary');
  const initial = initialAnswers(checkin, steps);
  const answers = { ...initial, ...changes };
  const existingPhotos = checkin?.photos ?? [];
  const onDate = checkin?.onDate ?? pickedDay ?? today;
  // A check-in with values or photos opens at its summary; a new or skipped one at the start.
  const current =
    index ??
    (checkin && (Object.keys(checkin.values).length > 0 || checkin.photos.length > 0)
      ? summaryIndex
      : 0);
  const step = steps[current];
  const dirty = answersChanged(initial, answers, photoChanges, existingPhotos);

  function requestClose() {
    if (uploading) {
      closedWhileUploading.current = true;
      onOpenChange(false);
    } else if (dirty) setConfirming(true);
    else onOpenChange(false);
  }

  async function saveCheckin() {
    const values = checkinValues(steps, answers, checkin);
    const { input, previous } = newCheckin(checkins, onDate, values);
    const plan = photoPlan(existingPhotos, photoChanges);
    const saved = () => {
      showToast('Zwischenstand gespeichert', {
        label: 'Rückgängig',
        onAction: () => {
          if (previous) restore.mutate(previous);
          else remove.mutate(input.id);
        },
      });
    };
    const removePhotos = () => {
      for (const photo of plan.remove)
        deletePhoto.mutate(photo, {
          onError: () => {
            showToast('Foto konnte nicht entfernt werden.');
          },
        });
    };

    if (plan.add.length === 0) {
      // Nothing to upload: closes at once, saved in the background.
      onOpenChange(false);
      save.mutate(input, {
        onError: () => {
          showToast('Zwischenstand konnte nicht gespeichert werden.');
        },
      });
      removePhotos();
      saved();
      return;
    }

    // New pictures need the saved check-in, then upload one after the other (downscaling
    // three camera pictures at once is too much for a phone's memory).
    closedWhileUploading.current = false;
    setUploading({ done: 0, total: plan.add.length });
    let checkinId: string;
    try {
      checkinId = await save.mutateAsync(input);
    } catch {
      setUploading(null);
      showToast('Zwischenstand konnte nicht gespeichert werden.');
      return;
    }
    removePhotos();
    let failed = 0;
    for (const [i, item] of plan.add.entries()) {
      try {
        await addPhoto.mutateAsync({ checkinId, pose: item.pose, file: item.file });
      } catch {
        failed += 1;
      }
      setUploading({ done: i + 1, total: plan.add.length });
    }
    setUploading(null);
    if (
      failed === plan.add.length &&
      plan.photos === plan.add.length &&
      Object.keys(values).length === 0
    ) {
      // Nothing of it arrived: an empty check-in would still count as done. Take the save
      // back and keep the flow open (with the pictures) to try again.
      if (previous) restore.mutate(previous);
      else remove.mutate(checkinId);
      showToast(
        failed === 1
          ? 'Das Foto konnte nicht hochgeladen werden. Versuch es noch einmal.'
          : 'Die Fotos konnten nicht hochgeladen werden. Versuch es noch einmal.',
      );
      return;
    }
    // (Read through a function: the awaits above may have changed it.)
    if (!wasClosedWhileUploading()) onOpenChange(false);
    if (failed > 0)
      showToast(
        failed === 1
          ? 'Ein Foto konnte nicht hochgeladen werden.'
          : `${String(failed)} Fotos konnten nicht hochgeladen werden.`,
      );
    saved();
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
  // (Not while uploading: by then the saved one is in the list itself.)
  const replaces = !checkin && !uploading && checkinOn(checkins, onDate)?.skipped === false;

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
        {step?.type === 'photos' && poses && (
          <CheckinPhotoStep
            poses={poses}
            existing={existingPhotos}
            photos={photoChanges}
            previous={previousPosePhotos(checkins, onDate, checkin?.id ?? null)}
            formatDay={(day) => dayText(day, today)}
            isLast={steps[current + 1]?.type === 'summary'}
            onBack={
              current > 0
                ? () => {
                    setIndex(current - 1);
                  }
                : undefined
            }
            onChange={(pose, answer) => {
              setPhotoChanges((p) => {
                const rest = Object.fromEntries(Object.entries(p).filter(([key]) => key !== pose));
                return answer === undefined ? rest : { ...rest, [pose]: answer };
              });
            }}
            onLeave={() => {
              setIndex(current + 1);
            }}
          />
        )}
        {step?.type === 'summary' && poses && (
          <Summary
            rows={summaryRows(steps, answers, previousValues(checkins, onDate))}
            photos={shownPhotos(poses, existingPhotos, photoChanges)}
            dayLine={longDate.format(date(onDate))}
            replaces={replaces}
            uploading={uploading}
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
            onEditPhotos={() => {
              setIndex(steps.findIndex((s) => s.type === 'photos'));
            }}
            canSave={canSaveCheckin(steps, answers, checkin, photoChanges)}
            onSave={() => {
              void saveCheckin();
            }}
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
        description="Was du eingegeben hast, wird nicht gespeichert."
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
            Weitermachen
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
        <CheckinStepHeader onBack={onBack} counter={`${String(position)} von ${String(count)}`} />
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
  photos,
  dayLine,
  replaces,
  uploading,
  onBack,
  onEdit,
  onEditPhotos,
  canSave,
  onSave,
  onDelete,
}: {
  rows: ReturnType<typeof summaryRows>;
  photos: ShownPhoto[];
  dayLine: string;
  replaces: boolean;
  uploading: { done: number; total: number } | null;
  onBack: (() => void) | undefined;
  onEdit: (kind: MeasurementKind) => void;
  onEditPhotos: () => void;
  canSave: boolean;
  onSave: () => void;
  onDelete: (() => void) | undefined;
}) {
  const busy = uploading !== null;
  return (
    <div className="flex min-h-sheet-min flex-col gap-5 pt-1">
      <div className="flex flex-col gap-1">
        <CheckinStepHeader onBack={busy ? undefined : onBack} counter={null} />
        <h3 className="text-title-2 font-bold">Übersicht</h3>
        <p className="text-subhead text-text-muted">{dayLine}</p>
      </div>
      <ul className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
        {rows.map((row) => (
          <li key={row.kind.key}>
            <button
              type="button"
              disabled={busy}
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
        <li>
          <button
            type="button"
            disabled={busy}
            onClick={onEditPhotos}
            className="flex min-h-tap w-full items-center gap-3 px-4 py-2 text-left active:bg-surface-3"
          >
            <span
              className={cn(
                'min-w-0 flex-1 truncate text-body',
                photos.length === 0 && 'text-text-muted',
              )}
            >
              Fotos
            </span>
            {photos.length === 0 ? (
              <span className="text-subhead text-text-subtle">keine</span>
            ) : (
              <span className="flex gap-1.5">
                {photos.map((shown) =>
                  shown.blob ? (
                    <BlobImage
                      key={shown.pose.key}
                      blob={shown.blob}
                      alt={shown.pose.label}
                      className="aspect-3/4 w-7 rounded-sm object-cover"
                    />
                  ) : shown.photo ? (
                    <StoredImage
                      key={shown.pose.key}
                      path={shown.photo.thumbPath}
                      alt={shown.pose.label}
                      className="aspect-3/4 w-7 rounded-sm object-cover"
                    />
                  ) : null,
                )}
              </span>
            )}
            <ChevronRightIcon aria-hidden className="shrink-0 text-text-subtle" />
          </button>
        </li>
      </ul>
      {replaces && (
        <p className="text-footnote text-text-subtle">
          An diesem Tag gibt es schon einen Zwischenstand. Seine Maße werden ersetzt.
        </p>
      )}
      <div className="mt-auto flex flex-col gap-2 pb-2">
        {uploading && (
          <p aria-live="polite" className="text-center text-footnote text-text-muted">
            {uploading.total === 1
              ? 'Foto wird hochgeladen …'
              : `Foto ${String(Math.min(uploading.done + 1, uploading.total))} von ${String(uploading.total)} wird hochgeladen …`}
          </p>
        )}
        <Button
          size="lg"
          loading={busy}
          missing={canSave ? null : 'Trag mindestens ein Maß ein oder füge ein Foto hinzu.'}
          onClick={onSave}
        >
          Speichern
        </Button>
        {onDelete && !busy && (
          <Button variant="danger" fullWidth onClick={onDelete}>
            Zwischenstand löschen
          </Button>
        )}
      </div>
    </div>
  );
}
