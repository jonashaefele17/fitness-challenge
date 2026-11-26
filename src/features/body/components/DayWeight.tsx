import { useState } from 'react';
import { ChevronRightIcon, PlusIcon } from '@/shared/ui';
import { useScales, useWeighIns } from '../api/useWeight';
import { formatKg, todayKey } from '../format';
import type { WeighIn } from '../types';
import { WeighInSheet } from './WeighInSheet';

/**
 * The calendar's day sheet ("Besonderes"): that day's weight (tap to change) or a quiet
 * way to add it; nothing for days still to come.
 */
export function DayWeight({ day }: { day: string }) {
  const [today] = useState(todayKey);
  const entries = useWeighIns(day, day).data;
  const scales = useScales().data ?? [];
  // Kept while the sheet closes, so its title does not change on the way out.
  const [shownEntry, setShownEntry] = useState<WeighIn | null>(null);
  const [editing, setEditing] = useState(false);
  if (day > today || entries === undefined) return null;
  const named = scales.length > 1;
  const main = scales.find((s) => s.isMain && !s.archived);

  return (
    <>
      {entries.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => {
            const scale = named
              ? (entry.scaleId ? scales.find((s) => s.id === entry.scaleId) : main)?.name
              : undefined;
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => {
                    setShownEntry(entry);
                    setEditing(true);
                  }}
                  className="flex min-h-tap w-full items-center gap-3 rounded-card bg-surface-2 px-4 py-2 text-left active:bg-surface-3"
                >
                  <span className="flex-1 text-subhead">
                    <span className="text-text-muted">Gewicht</span>
                    {scale && <span className="text-text-muted"> · {scale}</span>}
                  </span>
                  <span className="text-subhead font-semibold tabular-nums">
                    {formatKg(entry.weightKg)} kg
                  </span>
                  <ChevronRightIcon aria-hidden className="shrink-0 text-text-subtle" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <button
          type="button"
          onClick={() => {
            setShownEntry(null);
            setEditing(true);
          }}
          className="flex min-h-tap items-center gap-2 self-start rounded-pill px-1 text-subhead text-accent active:bg-surface-2"
        >
          <PlusIcon aria-hidden className="size-4" />
          {day === today ? 'Gewicht eintragen' : 'Gewicht nachtragen'}
        </button>
      )}
      <WeighInSheet open={editing} onOpenChange={setEditing} day={day} entry={shownEntry} />
    </>
  );
}
