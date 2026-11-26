import { useState } from 'react';
import { useUserId } from '@/features/auth';
import { Button } from '@/shared/ui';
import { useBodySettings, useWeighIns } from '../api/useWeight';
import { todayKey, weighDue, weighWindowStart } from '../format';
import { WeighInSheet } from './WeighInSheet';

/** The weigh day I chose to leave out; kept on this device only. */
const skipKey = (userId: string) => `body.weigh-skipped.${userId}`;

function readSkipped(userId: string): string | null {
  try {
    return localStorage.getItem(skipKey(userId));
  } catch {
    return null;
  }
}

/**
 * Heute: on one of my weigh days, as long as I have not weighed myself, a small card to do
 * it. After a missed weigh day it stays as "nachholen" until I weigh myself, leave it out,
 * or the next weigh day comes. Nothing otherwise.
 */
export function WeighTodayCard() {
  const userId = useUserId();
  const [today] = useState(todayKey);
  const settings = useBodySettings().data;
  const entries = useWeighIns(weighWindowStart(today), today);
  const [open, setOpen] = useState(false);
  const [skipped, setSkipped] = useState(() => readSkipped(userId));
  const due =
    settings && entries.isSuccess
      ? weighDue(
          today,
          settings.weighReminderDays,
          entries.data.map((entry) => entry.measuredOn),
          skipped,
        )
      : null;

  const skip = (day: string) => {
    setSkipped(day);
    try {
      localStorage.setItem(skipKey(userId), day);
    } catch {
      // Private mode: left out until the app is reopened.
    }
  };

  return (
    <>
      {due && (
        <section className="flex items-center justify-between gap-2 rounded-card bg-surface-2 py-3 pr-3 pl-4">
          <p className="min-w-0 text-subhead">
            <span className="font-semibold">Wiegen</span>
            <span className="text-text-muted">
              {due.missed ? ' · nachholen' : ' · heute noch offen'}
            </span>
          </p>
          <div className="flex shrink-0 items-center">
            {due.missed && (
              <Button
                variant="ghost"
                onClick={() => {
                  skip(due.day);
                }}
              >
                Auslassen
              </Button>
            )}
            <Button
              variant="tinted"
              onClick={() => {
                setOpen(true);
              }}
            >
              Eintragen
            </Button>
          </div>
        </section>
      )}
      {/* Stays mounted when the card goes away, so "Rückgängig" still works. */}
      <WeighInSheet open={open} onOpenChange={setOpen} day={today} />
    </>
  );
}
