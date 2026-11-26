import { useContext, useState, type ReactNode } from 'react';
import { startOfDay } from '../../calendar';
import { WorkoutDetailSheet } from '../workout-detail/WorkoutDetailSheet';
import { GroupPicker } from './GroupPicker';
import { GroupWeeks } from './GroupWeeks';
import { ACCENT, readSetting, writeSetting } from './logData';
import { MonthView } from './MonthView';
import { CalendarPeopleContext } from './people';

const SHOWN_KEY = 'training.log.people';

function readShown(): string[] {
  try {
    const parsed: unknown = JSON.parse(readSetting(SHOWN_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Training log. Nobody else chosen: my month on one screen. One or more group mates
 * chosen (the "Gruppe" pill unfolds to pick them): the group's weeks like the iOS calendar, one row per
 * person. The choice is remembered.
 */
export function WorkoutLog({
  daySpecial,
}: {
  /** "Besonderes" in a day's sheet (e.g. the day's weight), plugged in by the app. */
  daySpecial?: (day: string) => ReactNode;
} = {}) {
  const [today] = useState(() => startOfDay(new Date()));
  const [shownIds, setShownIds] = useState(readShown);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  // People only (names, colours); loads no workouts while disabled.
  const usePeople = useContext(CalendarPeopleContext);
  const group = usePeople({ from: today, to: today }, false);
  const shown = group.people.filter((person) => shownIds.includes(person.id));
  // Decide from the remembered choice right away (no flash of my month while the group
  // loads); once the group is known, drop people who are no longer in it.
  const groupView = shownIds.length > 0 && (!group.ready || shown.length > 0);

  function toggle(personId: string) {
    setShownIds((current) => {
      const next = current.includes(personId)
        ? current.filter((id) => id !== personId)
        : [...current, personId];
      writeSetting(SHOWN_KEY, JSON.stringify(next));
      return next;
    });
  }

  const groupButton = group.available ? (
    <GroupPicker
      people={group.people}
      shownIds={shownIds}
      onToggle={toggle}
      open={pickerOpen}
      onOpenChange={setPickerOpen}
    />
  ) : null;

  return (
    <>
      {groupView ? (
        <GroupWeeks
          today={today}
          shownIds={shownIds}
          headerEnd={groupButton}
          onOpen={setOpenId}
          special={daySpecial}
        />
      ) : (
        <MonthView
          today={today}
          color={group.myColor ?? ACCENT}
          headerEnd={groupButton}
          special={daySpecial}
        />
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
