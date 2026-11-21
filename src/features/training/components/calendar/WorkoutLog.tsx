import { useContext, useState } from 'react';
import { cn } from '@/shared/lib';
import { startOfDay } from '../../calendar';
import { WorkoutDetailSheet } from '../workout-detail/WorkoutDetailSheet';
import { GroupWeeks } from './GroupWeeks';
import { readSetting, writeSetting } from './logData';
import { MonthView } from './MonthView';
import { CalendarPeopleContext } from './people';

const GROUP_KEY = 'training.log.all';

/**
 * Training log: my month on one screen, or with "Gruppe" the group's weeks like the iOS
 * calendar (today's week at the top, one row per person).
 */
export function WorkoutLog() {
  const [today] = useState(() => startOfDay(new Date()));
  const [group, setGroup] = useState(() => readSetting(GROUP_KEY) === '1');
  const [openId, setOpenId] = useState<string | null>(null);
  // Only asks whether anyone else is there; loads nothing while disabled.
  const usePeople = useContext(CalendarPeopleContext);
  const available = usePeople({ from: today, to: today }, false).available;
  const showGroup = group && available;

  const groupSwitch = available ? (
    <button
      type="button"
      aria-pressed={group}
      onClick={() => {
        setGroup((on) => {
          writeSetting(GROUP_KEY, on ? '0' : '1');
          return !on;
        });
      }}
      className={cn(
        'flex min-h-tap shrink-0 items-center rounded-pill border px-4 text-subhead font-semibold',
        group ? 'border-accent bg-accent text-on-accent' : 'border-border bg-surface-2',
      )}
    >
      Gruppe
    </button>
  ) : null;

  return (
    <>
      {showGroup ? (
        <GroupWeeks today={today} headerEnd={groupSwitch} onOpen={setOpenId} />
      ) : (
        <MonthView today={today} headerEnd={groupSwitch} onOpen={setOpenId} />
      )}
      <WorkoutDetailSheet
        workoutId={openId}
        onClose={() => {
          setOpenId(null);
        }}
      />
    </>
  );
}
