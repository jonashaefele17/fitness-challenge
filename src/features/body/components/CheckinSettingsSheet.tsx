import { showToast } from '@/shared/lib';
import { Chip, FieldGroup, Sheet, Switch } from '@/shared/ui';
import { useMeasurementKinds } from '../api/useCheckins';
import { useBodySettings, useSaveBodySettings } from '../api/useWeight';
import type { BodySettings } from '../types';

const DEFAULT_TIME = '08:00';
/** The rhythms offered; another stored one (1 … 12) shows as an extra chip. */
const WEEKS = [2, 4, 6, 8];

/** Zwischenstand: the rhythm, the reminder time and which measurements I take. */
export function CheckinSettingsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const settings = useBodySettings().data;
  const kinds = useMeasurementKinds().data ?? [];
  const save = useSaveBodySettings();
  const change = (next: Partial<BodySettings>) => {
    save.mutate(next, {
      onError: () => {
        showToast('Einstellung konnte nicht gespeichert werden.');
      },
    });
  };

  const every = settings?.checkinEveryWeeks ?? null;
  const choices =
    every === null || WEEKS.includes(every) ? WEEKS : [...WEEKS, every].sort((a, b) => a - b);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Zwischenstand">
      {settings && (
        <div className="flex flex-col gap-5 pt-1">
          <FieldGroup label="Alle … Wochen">
            <div className="flex flex-wrap gap-2">
              <Chip
                selected={every === null}
                onClick={() => {
                  change({ checkinEveryWeeks: null });
                }}
              >
                Aus
              </Chip>
              {choices.map((weeks) => (
                <Chip
                  key={weeks}
                  selected={every === weeks}
                  className="min-w-12 justify-center"
                  onClick={() => {
                    change({
                      checkinEveryWeeks: weeks,
                      // Switching a rhythm on brings the reminder with it, as for weighing.
                      ...(every === null &&
                        settings.checkinReminderAt === null && { checkinReminderAt: DEFAULT_TIME }),
                    });
                  }}
                >
                  {weeks}
                </Chip>
              ))}
            </div>
          </FieldGroup>
          <p className="-mt-2 text-footnote text-text-muted">
            Schaltest du einen Rhythmus ein, ist der erste Zwischenstand sofort fällig – als
            Ausgangspunkt.
          </p>

          {every !== null && (
            <div className="flex flex-col rounded-card bg-surface-2 px-4">
              <Switch
                label="Erinnerung per Push"
                checked={settings.checkinReminderAt !== null}
                onCheckedChange={(on) => {
                  change({ checkinReminderAt: on ? DEFAULT_TIME : null });
                }}
              />
              {settings.checkinReminderAt !== null && (
                <div className="flex min-h-tap items-center justify-between gap-3 border-t border-border py-2">
                  <span className="text-body">Uhrzeit</span>
                  <input
                    type="time"
                    aria-label="Uhrzeit der Erinnerung"
                    value={settings.checkinReminderAt}
                    onChange={(event) => {
                      if (event.target.value) change({ checkinReminderAt: event.target.value });
                    }}
                    className="h-tap rounded-sm bg-surface-3 px-2 text-subhead tabular-nums"
                  />
                </div>
              )}
            </div>
          )}

          <FieldGroup label="Maße">
            <div className="flex flex-col divide-y divide-border rounded-card bg-surface-2 px-4">
              {kinds.map((kind) => {
                const hidden = settings.hiddenMeasurementKinds;
                const on = !hidden.includes(kind.key);
                return (
                  <Switch
                    key={kind.key}
                    label={kind.label}
                    checked={on}
                    onCheckedChange={(next) => {
                      if (
                        !next &&
                        kinds.every((k) => k.key === kind.key || hidden.includes(k.key))
                      ) {
                        showToast('Ein Maß bleibt mindestens an.');
                        return;
                      }
                      change({
                        hiddenMeasurementKinds: next
                          ? hidden.filter((key) => key !== kind.key)
                          : [...hidden, kind.key],
                      });
                    }}
                  />
                );
              })}
            </div>
          </FieldGroup>
          <p className="-mt-2 text-footnote text-text-subtle">
            Ausgeschaltete Maße fragt der Zwischenstand nicht mehr ab. Was du schon gemessen hast,
            bleibt gespeichert.
          </p>
        </div>
      )}
    </Sheet>
  );
}
