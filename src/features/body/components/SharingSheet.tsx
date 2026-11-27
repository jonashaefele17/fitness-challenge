import { showToast } from '@/shared/lib';
import { FieldGroup, SegmentedControl, Sheet } from '@/shared/ui';
import { useBodySettings, useSaveBodySettings } from '../api/useWeight';
import { WEIGHT_SHARE_LABELS } from '../format';
import type { WeightShare } from '../types';

const DESCRIPTIONS: Record<WeightShare, string> = {
  private: 'Niemand sieht dein Gewicht.',
  percent: 'Deine Gruppe sieht, um wie viel Prozent sich dein Gewicht verändert, aber keine kg.',
  kg: 'Deine Gruppe sieht deinen 7-Tage-Durchschnitt in kg.',
};

const OPTIONS = (['private', 'percent', 'kg'] as const).map((value) => ({
  value,
  label: WEIGHT_SHARE_LABELS[value],
}));

/** Who sees my weight: nobody, only the change in %, or the 7-day average in kg. */
export function SharingSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const settings = useBodySettings().data;
  const save = useSaveBodySettings();

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Sichtbarkeit">
      {settings && (
        <div className="flex flex-col gap-5 pt-1">
          <FieldGroup label="Wer sieht das?">
            <div className="flex flex-col gap-2">
              <SegmentedControl
                label="Wer sieht das"
                value={settings.weightShare}
                onChange={(weightShare) => {
                  save.mutate(
                    { weightShare },
                    {
                      onError: () => {
                        showToast('Sichtbarkeit konnte nicht gespeichert werden.');
                      },
                    },
                  );
                }}
                options={OPTIONS}
              />
              <p className="text-footnote text-text-muted">{DESCRIPTIONS[settings.weightShare]}</p>
            </div>
          </FieldGroup>
          <p className="text-footnote text-text-subtle">
            Einzelne Messungen und deine Waagen sieht nie jemand außer dir.
          </p>
        </div>
      )}
    </Sheet>
  );
}
