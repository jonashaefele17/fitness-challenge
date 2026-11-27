import { useState } from 'react';
import { showToast } from '@/shared/lib';
import { Button } from '@/shared/ui';
import {
  useCheckins,
  useCheckinStatus,
  useDeleteCheckin,
  useSkipCheckin,
} from '../api/useCheckins';
import { checkinDueText, checkinOn } from '../checkin';
import { todayKey } from '../format';
import { CheckinFlow } from './CheckinFlow';

/**
 * Heute: while my Zwischenstand is due, a small card to start it or leave it out for this
 * time (the rhythm moves on by one cycle). Nothing otherwise.
 */
export function CheckinTodayCard() {
  const [today] = useState(todayKey);
  const status = useCheckinStatus(today).data;
  const checkins = useCheckins();
  const skip = useSkipCheckin();
  const remove = useDeleteCheckin();
  const [open, setOpen] = useState(false);
  // Gone at once after saving or skipping today (the list changes before the status does).
  const doneToday = checkins.data ? checkinOn(checkins.data, today) !== undefined : true;
  const dueText = status ? checkinDueText(status) : null;

  function skipToday() {
    const id = crypto.randomUUID();
    const hadOne = checkins.data ? checkinOn(checkins.data, today) !== undefined : true;
    skip.mutate(
      { id, onDate: today },
      {
        onError: () => {
          showToast('Zwischenstand konnte nicht ausgelassen werden.');
        },
      },
    );
    showToast(
      'Zwischenstand ausgelassen',
      hadOne
        ? undefined
        : {
            label: 'Rückgängig',
            onAction: () => {
              remove.mutate(id);
            },
          },
    );
  }

  return (
    <>
      {status?.due && !doneToday && (
        // Text above the buttons: "Zwischenstand · seit 12 Tagen fällig" does not fit next to
        // both of them on a phone.
        <section className="flex flex-col gap-1 rounded-card bg-surface-2 py-3 pr-3 pl-4">
          <p className="min-w-0 pt-1 text-subhead">
            <span className="font-semibold">Zwischenstand</span>
            {dueText && <span className="text-text-muted"> · {dueText}</span>}
          </p>
          <div className="flex items-center justify-end">
            <Button variant="ghost" onClick={skipToday}>
              Auslassen
            </Button>
            <Button
              variant="tinted"
              onClick={() => {
                setOpen(true);
              }}
            >
              Starten
            </Button>
          </div>
        </section>
      )}
      {/* Stays mounted when the card goes away, so "Rückgängig" still works. */}
      <CheckinFlow open={open} onOpenChange={setOpen} />
    </>
  );
}
