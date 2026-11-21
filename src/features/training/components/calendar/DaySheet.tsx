import { useState } from 'react';
import { Sheet } from '@/shared/ui';
import type { CalendarWorkout } from '../../types';
import { WorkoutDetailSheet } from '../workout-detail/WorkoutDetailSheet';
import { DayList } from './DayList';
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
    >
      <DayList entries={entries} showNames={showNames} onOpen={setOpenId} />
      <WorkoutDetailSheet
        workoutId={openId}
        onClose={() => {
          setOpenId(null);
        }}
      />
    </Sheet>
  );
}
