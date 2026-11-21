import { useState } from 'react';
import { cn } from '@/shared/lib';
import { useDeviceTypes, useRememberDevice } from '../api/usePlaces';
import type { WorkoutItem } from '../types';

/**
 * "Gerät merken?" in the summary: exercises done at a place without a device, each with
 * the device types that offer it. One tap adds the device to the place (if missing) and
 * links the workout to it, so history and "Vorher" are right next time.
 */
export function RememberDevices({
  locationId,
  locationName,
  items,
}: {
  locationId: string;
  locationName: string;
  /** Exercises of the workout that had no device. */
  items: Pick<WorkoutItem, 'id' | 'exercise'>[];
}) {
  const types = useDeviceTypes().data ?? [];
  const remember = useRememberDevice(locationId);
  const [done, setDone] = useState<Record<string, string>>({});
  const rows = items
    .map((item) => ({
      item,
      candidates: types.filter((type) =>
        type.exercises.some((exercise) => exercise.id === item.exercise.id),
      ),
    }))
    .filter((row) => row.candidates.length > 0);

  if (rows.length === 0) return null;

  return (
    <section className="flex flex-col gap-3 rounded-card bg-surface-2 p-4">
      <div className="flex flex-col">
        <h3 className="text-subhead font-semibold">Gerät merken?</h3>
        <p className="text-footnote text-text-muted">
          An welchem Gerät in {locationName}? Dann stimmt dein Verlauf beim nächsten Mal.
        </p>
      </div>
      {rows.map(({ item, candidates }) => (
        <div key={item.id} className="flex flex-col gap-1.5">
          <span className="text-subhead">{item.exercise.name}</span>
          <div className="-mx-4 no-scrollbar flex gap-2 overflow-x-auto px-4">
            {candidates.map((type) => {
              const chosen = done[item.id] === type.id;
              return (
                <button
                  key={type.id}
                  type="button"
                  aria-pressed={chosen}
                  disabled={item.id in done || remember.isPending}
                  onClick={() => {
                    remember.mutate(
                      { itemId: item.id, typeId: type.id },
                      {
                        onSuccess: () => {
                          setDone((current) => ({ ...current, [item.id]: type.id }));
                        },
                      },
                    );
                  }}
                  className={cn(
                    'flex min-h-tap shrink-0 items-center rounded-pill border px-3 text-subhead font-semibold disabled:opacity-60',
                    chosen
                      ? 'border-accent bg-accent text-on-accent disabled:opacity-100'
                      : 'border-border bg-surface-3',
                  )}
                >
                  {chosen ? `✓ ${type.name}` : type.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {remember.isError && (
        <p role="alert" className="text-footnote text-danger">
          Merken hat nicht geklappt.
        </p>
      )}
    </section>
  );
}
