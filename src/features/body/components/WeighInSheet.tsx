import { useState } from 'react';
import { showToast } from '@/shared/lib';
import { Button, Chip, FieldGroup, NumberWheel, Sheet } from '@/shared/ui';
import {
  newWeighIn,
  useAddWeighIn,
  useDeleteWeighIn,
  useRestoreWeighIn,
  useScales,
  useUpdateWeighIn,
  useWeighIns,
  useWeightSummary,
} from '../api/useWeight';
import { formatKg, measuredAtOn, parseKg, periodRange, timeOf, todayKey } from '../format';
import type { Scale, WeighIn } from '../types';

const dayTitle = new Intl.DateTimeFormat('de', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** Where the wheel starts for the very first weigh-in (nothing is saved until it is moved). */
const FIRST_WEIGHT_START_KG = 75;

/** Time offered for a back-filled entry when there is no earlier one to go by. */
const DEFAULT_TIME = '07:00';

interface WeighInInput {
  weightKg: number;
  scaleId: string | null;
  day: string;
  /** Local clock time "HH:MM". */
  time: string;
}

/**
 * Enter or change one weigh-in (under 10 seconds): the last value is already there on a
 * wheel in 0,1 steps, a tap on it types instead. Saving closes at once; "Rückgängig"
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

  function save(input: WeighInInput) {
    onOpenChange(false);
    if (entry) {
      const before = entry;
      update.mutate(
        {
          id: entry.id,
          weightKg: input.weightKg,
          scaleId: input.scaleId,
          measuredAt: measuredAtOn(input.day, input.time),
        },
        { onError: failed },
      );
      showToast('Eintrag geändert', {
        label: 'Rückgängig',
        onAction: () => {
          update.mutate({
            id: before.id,
            weightKg: before.weightKg,
            scaleId: before.scaleId,
            measuredAt: before.measuredAt,
          });
        },
      });
      return;
    }
    const created = newWeighIn({
      scaleId: input.scaleId,
      measuredOn: input.day,
      weightKg: input.weightKg,
      measuredAt: measuredAtOn(input.day, input.time),
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
  onSave: (input: WeighInInput) => void;
  onDelete: (() => void) | undefined;
}) {
  const scales = activeScales(useScales().data ?? []);
  const summary = useWeightSummary(null, todayKey()).data;
  const [range] = useState(() => periodRange('3m'));
  const lastEntry = useWeighIns(range.from, range.to).data?.[0];
  // Untouched: the last value (or the entry's) shows as soon as it is known.
  const [draft, setDraft] = useState<number | null>(null);
  const [pickedScale, setPickedScale] = useState<string | null | undefined>(undefined);
  const [pickedTime, setPickedTime] = useState<string | null>(null);
  const [now] = useState(() => timeOf(new Date()));

  const main = scales.find((s) => s.isMain) ?? scales[0];
  const latestScale = scales.find((s) => s.id === summary?.latestScaleId);
  const preselected = entry
    ? (entry.scaleId ?? main?.id ?? null)
    : (latestScale?.id ?? main?.id ?? null);
  const scaleId = pickedScale === undefined ? preselected : pickedScale;
  const value = draft ?? entry?.weightKg ?? summary?.latestKg ?? null;
  // Today: now. Another day: when I usually weigh myself (my last entry's time).
  const usual = lastEntry ? timeOf(lastEntry.measuredAt) : DEFAULT_TIME;
  const time = pickedTime ?? (entry ? timeOf(entry.measuredAt) : day === todayKey() ? now : usual);

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="flex flex-col items-center gap-1 rounded-card bg-surface-2 py-3">
        <span className="text-footnote text-text-muted">Gewicht in kg</span>
        <NumberWheel
          value={value}
          suggested={false}
          step={0.1}
          emptyStart={FIRST_WEIGHT_START_KG}
          label="Gewicht in kg"
          format={formatKg}
          parse={(text) => parseKg(text) ?? Number.NaN}
          onChange={(next) => {
            // The wheel can roll past what a person weighs; keep the last valid value.
            if (parseKg(String(next)) !== null) setDraft(next);
          }}
        />
        {value === null && (
          <span className="text-footnote text-text-subtle">Drehen oder antippen und eingeben</span>
        )}
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

      <div className="flex min-h-tap items-center justify-between gap-3 rounded-card bg-surface-2 px-4 py-2">
        <span className="text-body">Uhrzeit</span>
        <input
          type="time"
          aria-label="Uhrzeit des Wiegens"
          value={time}
          onChange={(event) => {
            if (event.target.value) setPickedTime(event.target.value);
          }}
          className="h-tap rounded-sm bg-surface-3 px-2 text-subhead tabular-nums"
        />
      </div>

      <p className="text-center text-footnote text-text-subtle">Am besten morgens nüchtern</p>

      <div className="flex flex-col gap-2">
        <Button
          size="lg"
          fullWidth
          disabled={value === null}
          onClick={() => {
            if (value !== null) onSave({ weightKg: value, scaleId, day, time });
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
