import { cn, showToast } from '@/shared/lib';
import { CheckIcon, Sheet } from '@/shared/ui';
import { useBodySettings, useSaveBodySettings } from '../api/useWeight';
import { WEIGHT_SHARE_LABELS } from '../format';
import type { WeightShare } from '../types';

const DESCRIPTIONS: Record<WeightShare, string> = {
  private: 'Niemand sieht dein Gewicht.',
  percent: 'Deine Gruppe sieht, um wie viel Prozent sich dein Gewicht verändert, aber keine kg.',
  kg: 'Deine Gruppe sieht deinen 7-Tage-Durchschnitt in kg.',
  days: 'Deine Gruppe sieht den Durchschnitt und zusätzlich den Wert jedes Tages in kg.',
};

const LEVELS = ['private', 'percent', 'kg', 'days'] as const;

/**
 * Who sees my weight: nobody, only the change in %, the 7-day average in kg, or also the
 * day values. One row per choice with what it means; saved at once.
 */
export function SharingSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Sichtbarkeit">
      <WeightShareChoice />
    </Sheet>
  );
}

/** The four sharing levels as rows (saved at once); also asked in the season setup. */
export function WeightShareChoice() {
  const settings = useBodySettings().data;
  const save = useSaveBodySettings();
  if (!settings) return null;
  return (
    <div className="flex flex-col gap-4 pt-1">
      <div role="radiogroup" aria-label="Wer sieht dein Gewicht" className="flex flex-col gap-2">
        {LEVELS.map((level) => {
          const selected = settings.weightShare === level;
          return (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => {
                if (selected) return;
                save.mutate(
                  { weightShare: level },
                  {
                    onError: () => {
                      showToast('Sichtbarkeit konnte nicht gespeichert werden.');
                    },
                  },
                );
              }}
              className={cn(
                'flex min-h-tap w-full items-center justify-between gap-3 rounded-card border px-4 py-3 text-left',
                selected
                  ? 'border-accent bg-surface-3'
                  : 'border-border bg-surface-2 active:bg-surface-3',
              )}
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-body font-semibold">{WEIGHT_SHARE_LABELS[level]}</span>
                <span className="text-footnote text-text-muted">{DESCRIPTIONS[level]}</span>
              </span>
              {selected && <CheckIcon aria-hidden className="shrink-0 text-accent" />}
            </button>
          );
        })}
      </div>
      <p className="text-footnote text-text-subtle">
        Mehrere Einträge eines Tages, ihre Uhrzeit und deine Waagen sieht nie jemand außer dir.
      </p>
    </div>
  );
}
