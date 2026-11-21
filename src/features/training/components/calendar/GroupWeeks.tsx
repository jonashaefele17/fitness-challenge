import { useContext, useLayoutEffect, useRef, useState, type ReactNode, type UIEvent } from 'react';
import { cn } from '@/shared/lib';
import { Sheet } from '@/shared/ui';
import { useWorkoutsInRange } from '../../api/useCalendar';
import { addDays, dayKey, startOfWeek } from '../../calendar';
import type { CalendarWorkout } from '../../types';
import { DayList } from './DayList';
import { DayMarks } from './DayMarks';
import {
  ACCENT,
  byDay,
  dayTitle,
  monthTitle,
  readSetting,
  WEEKDAYS,
  writeSetting,
  type LogRow,
} from './logData';
import { CalendarPeopleContext } from './people';

/** Weeks loaded before today's week at first, and added each time the top is reached. */
const PAST_STEP = 26;
/** Weeks after today's week (planned appointments appear there). */
const FUTURE_WEEKS = 12;
/** Load older weeks when the list is scrolled this close to its top (px). */
const LOAD_MARGIN_PX = 400;
const HIDDEN_KEY = 'training.log.hidden';
const GRID = 'grid grid-cols-[1.75rem_repeat(7,minmax(0,1fr))] gap-x-0.5';

/**
 * The group's weeks like the iOS calendar: today's week at the top, scroll up into the
 * past and down into the future, one row per person (avatar, type icon, focus). Fills the
 * rest of the screen and scrolls inside without a visible scroll bar. People can be shown
 * or hidden (e.g. only my training partner).
 */
export function GroupWeeks({
  today,
  headerEnd,
  onOpen,
}: {
  today: Date;
  headerEnd: ReactNode;
  onOpen: (workoutId: string) => void;
}) {
  const [past, setPast] = useState(PAST_STEP);
  const [hidden, setHidden] = useState<string[]>(() => {
    try {
      const parsed: unknown = JSON.parse(readSetting(HIDDEN_KEY) ?? '[]');
      return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
    } catch {
      return [];
    }
  });
  const [visibleMonth, setVisibleMonth] = useState(today);
  const [day, setDay] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const thisWeek = useRef<HTMLDivElement>(null);
  const heightBeforeLoad = useRef<number | null>(null);

  const thisMonday = startOfWeek(today);
  const first = addDays(thisMonday, -7 * past);
  const mondays = Array.from({ length: past + FUTURE_WEEKS + 1 }, (_, index) =>
    addDays(first, 7 * index),
  );
  const range = { from: first, to: addDays(thisMonday, 7 * (FUTURE_WEEKS + 1)) };
  const mine = useWorkoutsInRange(range).data ?? [];
  const usePeople = useContext(CalendarPeopleContext);
  const others = usePeople(range, true);

  const rows: LogRow[] = [
    {
      id: 'me',
      initial: (others.myName ?? 'Du').charAt(0).toUpperCase(),
      name: 'Du',
      color: others.myColor ?? ACCENT,
      workouts: mine,
    },
    ...others.people
      .filter((person) => !hidden.includes(person.id))
      .map((person) => ({
        id: person.id,
        initial: person.name.charAt(0).toUpperCase(),
        name: person.name,
        color: person.color,
        workouts: person.workouts,
      })),
  ];
  const rowDays = rows.map((row) => byDay(row.workouts));

  // Reach down to the screen edge and run on behind the (translucent) navigation like any
  // iOS list; the bottom padding lets the last week scroll clear of it. Start at today's week.
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const top = element.getBoundingClientRect().top + window.scrollY;
    element.style.height = `calc(100dvh - ${String(top)}px)`;
    element.style.paddingBottom =
      'calc(env(safe-area-inset-bottom) + var(--spacing-nav) + var(--spacing) * 8)';
    element.scrollTop = thisWeek.current?.offsetTop ?? 0;
  }, []);

  // After older weeks were added above, keep the same weeks in view.
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element || heightBeforeLoad.current === null) return;
    element.scrollTop += element.scrollHeight - heightBeforeLoad.current;
    heightBeforeLoad.current = null;
  }, [past]);

  function onScroll(event: UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    if (element.scrollTop < LOAD_MARGIN_PX && heightBeforeLoad.current === null) {
      heightBeforeLoad.current = element.scrollHeight;
      setPast((count) => count + PAST_STEP);
    }
    // The month shown in the header is the one of the topmost visible week.
    const weeks = element.querySelectorAll<HTMLElement>('[data-week]');
    for (const week of weeks) {
      if (week.offsetTop + week.offsetHeight > element.scrollTop + 1) {
        const monday = new Date(`${week.dataset.week ?? ''}T00:00:00`);
        const thursday = addDays(monday, 3);
        if (
          thursday.getMonth() !== visibleMonth.getMonth() ||
          thursday.getFullYear() !== visibleMonth.getFullYear()
        ) {
          setVisibleMonth(thursday);
        }
        break;
      }
    }
  }

  function toggle(personId: string) {
    setHidden((current) => {
      const next = current.includes(personId)
        ? current.filter((id) => id !== personId)
        : [...current, personId];
      writeSetting(HIDDEN_KEY, JSON.stringify(next));
      return next;
    });
  }

  const dayEntries = day
    ? rows.flatMap((row, index) =>
        (rowDays[index]?.get(day) ?? []).map((workout) => ({ row, workout })),
      )
    : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <h2 className="min-w-0 truncate text-body font-semibold capitalize">
            {monthTitle.format(visibleMonth)}
          </h2>
          <button
            type="button"
            onClick={() => {
              scroller.current?.scrollTo({
                top: thisWeek.current?.offsetTop ?? 0,
                behavior: 'smooth',
              });
            }}
            className="min-h-tap shrink-0 px-2 text-footnote font-semibold text-accent"
          >
            Heute
          </button>
        </div>
        {headerEnd}
      </div>

      {others.people.length > 0 && (
        <div className="-mx-gutter no-scrollbar flex gap-2 overflow-x-auto px-gutter">
          {others.people.map((person) => {
            const on = !hidden.includes(person.id);
            return (
              <button
                key={person.id}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  toggle(person.id);
                }}
                className={cn(
                  'flex min-h-tap shrink-0 items-center gap-2 rounded-pill border px-3 text-subhead font-semibold',
                  on ? 'border-text-muted bg-surface-3' : 'border-border text-text-muted',
                )}
              >
                <span
                  aria-hidden
                  className={cn('size-2.5 rounded-pill', !on && 'opacity-40')}
                  style={{ backgroundColor: person.color }}
                />
                {person.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="pull-nav-clearance flex flex-col rounded-t-card bg-surface-2">
        <div
          aria-hidden
          className={cn(
            GRID,
            'border-b border-border px-1.5 py-1 text-center text-caption text-text-subtle',
          )}
        >
          <span />
          {WEEKDAYS.map((weekday) => (
            <span key={weekday}>{weekday}</span>
          ))}
        </div>
        <div
          ref={scroller}
          onScroll={onScroll}
          className="relative no-scrollbar overflow-y-auto overscroll-contain px-1.5"
        >
          {mondays.map((monday) => {
            const days = Array.from({ length: 7 }, (_, index) => addDays(monday, index));
            const firstOfMonth = days.find((date) => date.getDate() === 1);
            const isThisWeek = monday.getTime() === thisMonday.getTime();
            return (
              <div
                key={dayKey(monday)}
                ref={isThisWeek ? thisWeek : undefined}
                data-week={dayKey(monday)}
                className="flex flex-col border-b border-border py-1.5 last:border-b-0"
              >
                {firstOfMonth && (
                  <span className="px-1 pb-1 text-footnote font-semibold text-text-muted capitalize">
                    {monthTitle.format(firstOfMonth)}
                  </span>
                )}
                <div className={cn(GRID, 'items-center text-center text-caption tabular-nums')}>
                  <span />
                  {days.map((date) => {
                    const key = dayKey(date);
                    const isToday = key === dayKey(today);
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-label={dayTitle.format(date)}
                        onClick={() => {
                          setDay(key);
                        }}
                        className="flex min-h-tap items-center justify-center"
                      >
                        <span
                          className={cn(
                            'flex size-6 items-center justify-center rounded-pill',
                            isToday
                              ? 'bg-accent font-semibold text-on-accent'
                              : date > today
                                ? 'text-text-subtle'
                                : 'text-text-muted',
                          )}
                        >
                          {date.getDate()}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {rows.map((row, rowIndex) => (
                  <PersonWeek
                    key={row.id}
                    row={row}
                    days={days}
                    map={rowDays[rowIndex] ?? new Map<string, CalendarWorkout[]>()}
                    onOpen={onOpen}
                    onDay={setDay}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <Sheet
        open={day !== null}
        onOpenChange={(open) => {
          if (!open) setDay(null);
        }}
        title={day ? dayTitle.format(new Date(`${day}T00:00:00`)) : 'Tag'}
      >
        <DayList
          entries={dayEntries}
          showNames
          onOpen={(workoutId) => {
            setDay(null);
            onOpen(workoutId);
          }}
        />
      </Sheet>
    </div>
  );
}

function PersonWeek({
  row,
  days,
  map,
  onOpen,
  onDay,
}: {
  row: LogRow;
  days: Date[];
  map: Map<string, CalendarWorkout[]>;
  onOpen: (workoutId: string) => void;
  onDay: (key: string) => void;
}) {
  return (
    <div className={cn(GRID, 'items-center')}>
      <span
        aria-label={row.name}
        className="flex size-6 items-center justify-center rounded-pill text-caption font-semibold text-on-accent"
        style={{ backgroundColor: row.color }}
      >
        {row.initial}
      </span>
      {days.map((date) => {
        const key = dayKey(date);
        const workouts = map.get(key) ?? [];
        const first = workouts[0];
        if (!first) return <span key={key} className="min-h-tap" />;
        return (
          <button
            key={key}
            type="button"
            aria-label={`${row.name}, ${dayTitle.format(date)}`}
            onClick={() => {
              // One workout opens it; several show the day.
              if (workouts.length === 1) onOpen(first.id);
              else onDay(key);
            }}
            className="flex min-h-tap min-w-0 items-center justify-center rounded-sm active:bg-surface-3"
            style={{ color: row.color }}
          >
            <DayMarks workouts={workouts} />
          </button>
        );
      })}
    </div>
  );
}
