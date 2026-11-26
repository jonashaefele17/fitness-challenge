import { useState } from 'react';
import { showToast } from '@/shared/lib';
import { Button, Chip, FieldGroup, Sheet } from '@/shared/ui';
import {
  newWeighIn,
  useAddWeighIn,
  useDeleteWeighIn,
  useRestoreWeighIn,
  useScales,
  useUpdateWeighIn,
  useWeightSummary,
} from '../api/useWeight';
import { formatKg, measuredAtFor, parseKg, stepKg, todayKey } from '../format';
import type { Scale, WeighIn } from '../types';

const dayTitle = new Intl.DateTimeFormat('de', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const stepButton =
  'flex size-tap shrink-0 items-center justify-center rounded-pill bg-surface-2 text-subhead font-semibold tabular-nums active:bg-surface-3';

/**
 * Enter or change one weigh-in (under 10 seconds): the last value is already there, ±0,1 for
 * the usual small difference, the keyboard for the rest. Saving closes at once; "Rückgängig"
 * in the toast. Used from Ich, Heute and the calendar's day sheet.
 */
export function WeighInSheet({
  open,
  onOpenChange,
  day,
  entry = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Local day it counts for; default today. Ignored when changing an entry. */
  day?: string | undefined;
  /** An entry to change (or delete). */
  entry?: WeighIn | null;
}) {
  // The mutations live here, outside the sheet's content, so "Rückgängig" still works after
  // the sheet has closed.
  const add = useAddWeighIn();
  const update = useUpdateWeighIn();
  const remove = useDeleteWeighIn();
  const restore = useRestoreWeighIn();
  const failed = () => {
    showToast('Gewicht konnte nicht gespeichert werden.');
  };

  function save(input: { weightKg: number; scaleId: string | null; day: string }) {
    onOpenChange(false);
    if (entry) {
      const before = entry;
      update.mutate(
        { id: entry.id, weightKg: input.weightKg, scaleId: input.scaleId },
        { onError: failed },
      );
      showToast('Eintrag geändert', {
        label: 'Rückgängig',
        onAction: () => {
          update.mutate({ id: before.id, weightKg: before.weightKg, scaleId: before.scaleId });
        },
      });
      return;
    }
    const created = newWeighIn({
      scaleId: input.scaleId,
      measuredOn: input.day,
      weightKg: input.weightKg,
      measuredAt: measuredAtFor(input.day),
    });
    add.mutate(created, { onError: failed });
    showToast('Gewicht eingetragen', {
      label: 'Rückgängig',
      onAction: () => {
        remove.mutate(created.id);
      },
    });
  }

  function deleteEntry(target: WeighIn) {
    onOpenChange(false);
    remove.mutate(target.id, {
      onError: () => {
        showToast('Eintrag konnte nicht gelöscht werden.');
      },
    });
    showToast('Eintrag gelöscht', {
      label: 'Rückgängig',
      onAction: () => {
        restore.mutate(target);
      },
    });
  }

  const shownDay = entry?.measuredOn ?? day ?? todayKey();
  const isToday = shownDay === todayKey();
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={entry ? 'Eintrag ändern' : 'Gewicht eintragen'}
      {...(!isToday && { description: dayTitle.format(new Date(`${shownDay}T12:00:00`)) })}
      fullHeight
    >
      <WeighInForm
        day={shownDay}
        entry={entry}
        onSave={save}
        onDelete={
          entry
            ? () => {
                deleteEntry(entry);
              }
            : undefined
        }
      />
    </Sheet>
  );
}

/** Active scales; the chips only appear from two on. */
function activeScales(scales: Scale[]): Scale[] {
  return scales.filter((s) => !s.archived);
}

function WeighInForm({
  day,
  entry,
  onSave,
  onDelete,
}: {
  day: string;
  entry: WeighIn | null;
  onSave: (input: { weightKg: number; scaleId: string | null; day: string }) => void;
  onDelete: (() => void) | undefined;
}) {
  const scales = activeScales(useScales().data ?? []);
  const summary = useWeightSummary(null, todayKey()).data;
  // Untouched: the last value (or the entry's) shows as soon as it is known.
  const [draft, setDraft] = useState<string | null>(null);
  const [pickedScale, setPickedScale] = useState<string | null | undefined>(undefined);

  const main = scales.find((s) => s.isMain) ?? scales[0];
  const latestScale = scales.find((s) => s.id === summary?.latestScaleId);
  const preselected = entry
    ? (entry.scaleId ?? main?.id ?? null)
    : (latestScale?.id ?? main?.id ?? null);
  const scaleId = pickedScale === undefined ? preselected : pickedScale;
  const prefill = entry
    ? formatKg(entry.weightKg)
    : summary?.latestKg != null
      ? formatKg(summary.latestKg)
      : '';
  const text = draft ?? prefill;
  const value = parseKg(text);

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          aria-label="0,1 kg weniger"
          className={stepButton}
          onClick={() => {
            setDraft(stepKg(text, -0.1));
          }}
        >
          −0,1
        </button>
        <label className="flex min-w-0 items-baseline justify-center gap-1.5 rounded-card bg-surface-2 px-4 py-2">
          <span className="sr-only">Gewicht in kg</span>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="done"
            placeholder="0,0"
            value={text}
            onChange={(event) => {
              setDraft(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
            className="w-28 bg-transparent text-center text-large-title font-bold tabular-nums placeholder:text-text-subtle focus:outline-none"
          />
          <span className="text-title-3 text-text-muted">kg</span>
        </label>
        <button
          type="button"
          aria-label="0,1 kg mehr"
          className={stepButton}
          onClick={() => {
            setDraft(stepKg(text, 0.1));
          }}
        >
          +0,1
        </button>
      </div>

      {scales.length >= 2 && (
        <FieldGroup label="Waage">
          <div className="flex flex-wrap gap-2">
            {scales.map((scale) => (
              <Chip
                key={scale.id}
                selected={scale.id === scaleId}
                onClick={() => {
                  setPickedScale(scale.id);
                }}
              >
                {scale.name}
              </Chip>
            ))}
          </div>
        </FieldGroup>
      )}

      <p className="text-center text-footnote text-text-subtle">Am besten morgens nüchtern</p>

      <div className="flex flex-col gap-2">
        <Button
          size="lg"
          fullWidth
          disabled={value === null}
          onClick={() => {
            if (value !== null) onSave({ weightKg: value, scaleId, day });
          }}
        >
          {entry ? 'Speichern' : 'Eintragen'}
        </Button>
        {onDelete && (
          <Button variant="danger" fullWidth onClick={onDelete}>
            Eintrag löschen
          </Button>
        )}
      </div>
    </div>
  );
}
