import { showToast } from '@/shared/lib';
import { Chip, FieldGroup, Sheet } from '@/shared/ui';
import { useBodySettings, useSaveBodySettings } from '../api/useWeight';
import { WEEKDAYS } from '../format';
import type { BodySettings } from '../types';

const DEFAULT_TIME = '07:00';

/** "Wiegen"-reminder: the weekdays (none = no reminder) and the time. */
export function ReminderSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Erinnerung">
      <div className="flex flex-col gap-5 pt-1">
        <p className="text-footnote text-text-muted">
          Eine Push an diesen Tagen, wenn du dich noch nicht gewogen hast. Ohne Tage gibt es keine
          Erinnerung.
        </p>
        <WeighReminderFields />
      </div>
    </Sheet>
  );
}

/** The weigh days and the reminder time, saved at once (also in the season setup). */
export function WeighReminderFields() {
  const settings = useBodySettings().data;
  const save = useSaveBodySettings();
  const change = (next: Partial<BodySettings>) => {
    save.mutate(next, {
      onError: () => {
        showToast('Erinnerung konnte nicht gespeichert werden.');
      },
    });
  };
  if (!settings) return null;

  return (
    <>
      <FieldGroup label="Tage">
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((label, index) => {
            const weekday = index + 1;
            const on = settings.weighReminderDays.includes(weekday);
            return (
              <Chip
                key={label}
                selected={on}
                className="justify-center px-0"
                onClick={() => {
                  const days = on
                    ? settings.weighReminderDays.filter((d) => d !== weekday)
                    : [...settings.weighReminderDays, weekday].sort((a, b) => a - b);
                  change({
                    weighReminderDays: days,
                    weighReminderAt: settings.weighReminderAt ?? DEFAULT_TIME,
                  });
                }}
              >
                {label}
              </Chip>
            );
          })}
        </div>
      </FieldGroup>
      {settings.weighReminderDays.length > 0 && (
        <div className="flex min-h-tap items-center justify-between gap-3 rounded-card bg-surface-2 px-4 py-2">
          <span className="text-body">Uhrzeit</span>
          <input
            type="time"
            aria-label="Uhrzeit der Erinnerung"
            value={settings.weighReminderAt ?? DEFAULT_TIME}
            onChange={(event) => {
              if (event.target.value) {
                change({ ...settings, weighReminderAt: event.target.value });
              }
            }}
            className="h-tap rounded-sm bg-surface-3 px-2 text-subhead tabular-nums"
          />
        </div>
      )}
    </>
  );
}
