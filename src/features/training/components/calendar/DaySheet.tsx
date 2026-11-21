import { useState } from 'react';
import { PlusIcon, Sheet } from '@/shared/ui';
import type { CalendarWorkout } from '../../types';
import { WorkoutDetailSheet } from '../workout-detail/WorkoutDetailSheet';
import { DayList } from './DayList';
import { LogPastSheet } from './LogPastSheet';
import { dayTitle, type LogRow } from './logData';

/**
 * One day from the calendar as a bottom sheet: its workouts (of everyone shown), each
 * opening its detail on top (the day stays open behind it). The header's action slot is
 * where planning and adding a past workout for this day will go.
 */
export function DaySheet({
  day,
  entries,
  showNames,
  onClose,
}: {
  /** Day key ("2026-11-21") or null when closed. */
  day: string | null;
  entries: { row: LogRow; workout: CalendarWorkout }[];
  showNames: boolean;
  onClose: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [logging, setLogging] = useState(false);
  // Today and earlier: add a workout afterwards (planning ahead follows with Baustein 5).
  const [today] = useState(() => {
    const now = new Date();
    return `${String(now.getFullYear())}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const canLog = day !== null && day <= today;
  return (
    <Sheet
      open={day !== null}
      onOpenChange={(open) => {
        if (!open) {
          setOpenId(null);
          onClose();
        }
      }}
      title={day ? dayTitle.format(new Date(`${day}T00:00:00`)) : 'Tag'}
      action={
        canLog ? (
          <button
            type="button"
            aria-label="Training nachtragen"
            onClick={() => {
              setLogging(true);
            }}
            className="flex size-tap items-center justify-center rounded-pill text-title-2 text-accent active:bg-surface-2"
          >
            <PlusIcon />
          </button>
        ) : undefined
      }
    >
      <DayList entries={entries} showNames={showNames} onOpen={setOpenId} />
      {day && <LogPastSheet day={day} open={logging} onOpenChange={setLogging} />}
      <WorkoutDetailSheet
        workoutId={openId}
        onClose={() => {
          setOpenId(null);
        }}
      />
    </Sheet>
  );
}
