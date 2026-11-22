import { useContext, useLayoutEffect, useRef, useState, type ReactNode, type UIEvent } from 'react';
import { useUserId } from '@/features/auth';
import { cn } from '@/shared/lib';
import { useWorkoutsInRange } from '../../api/useCalendar';
import { usePlanOccurrences } from '../../api/usePlans';
import { addDays, dayKey, startOfWeek } from '../../calendar';
import type { CalendarWorkout, PlanOccurrence } from '../../types';
import { PlanSocialContext, type PlanPerson } from '../plans/social';
import { DaySheet } from './DaySheet';
import { DayMarks } from './DayMarks';
import { ACCENT, byDay, dayTitle, monthTitle, plansByDay, WEEKDAYS, type LogRow } from './logData';
import { CalendarPeopleContext } from './people';

/** Weeks added before/after the loaded ones each time the top/bottom is reached. */
const STEP_WEEKS = 26;
/** Load older weeks when the list is scrolled this close to its top (px). */
const LOAD_MARGIN_PX = 400;
const GRID = 'grid grid-cols-[1.75rem_repeat(7,minmax(0,1fr))] gap-x-0.5';

/**
 * The group's weeks like the iOS calendar: today's week at the top, scroll up into the
 * past and down into the future (both load more on the way), one row per person (avatar, type icon, focus). Fills the
 * rest of the screen, scrolls behind the navigation without a visible scroll bar.
 */
const PLACEHOLDER = 'var(--color-surface-3)';

export function GroupWeeks({
  today,
  shownIds,
  headerEnd,
  onOpen,
}: {
  today: Date;
  /** Group mates to show next to me. */
  shownIds: string[];
  headerEnd: ReactNode;
  onOpen: (workoutId: string) => void;
}) {
  const [past, setPast] = useState(STEP_WEEKS);
  // Future weeks: planned appointments and season dates appear there.
  const [future, setFuture] = useState(STEP_WEEKS);
  const [visibleMonth, setVisibleMonth] = useState(today);
  const [day, setDay] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const thisWeek = useRef<HTMLDivElement>(null);
  const heightBeforeLoad = useRef<number | null>(null);

  const thisMonday = startOfWeek(today);
  const first = addDays(thisMonday, -7 * past);
  const mondays = Array.from({ length: past + future + 1 }, (_, index) =>
    addDays(first, 7 * index),
  );
  const range = { from: first, to: addDays(thisMonday, 7 * (future + 1)) };
  const mine = useWorkoutsInRange(range).data ?? [];
  const myPlans = usePlanOccurrences({ from: range.from, to: addDays(range.to, -1) }).data ?? [];
  const usePeople = useContext(CalendarPeopleContext);
  const others = usePeople(range, true);

  const rows: LogRow[] = [
    {
      id: 'me',
      initial: (others.myName ?? 'Du').charAt(0).toUpperCase(),
      name: 'Du',
      color: others.ready ? (others.myColor ?? ACCENT) : PLACEHOLDER,
      workouts: mine,
      plans: myPlans,
    },
    // Until the group is known, hold the remembered rows' place so the weeks keep their
    // height (otherwise the list jumps when the others arrive after a cold start).
    ...(others.ready
      ? others.people
          .filter((person) => shownIds.includes(person.id))
          .map((person) => ({
            id: person.id,
            initial: person.name.charAt(0).toUpperCase(),
            name: person.name,
            color: person.color,
            workouts: person.workouts,
            plans: person.plans,
          }))
      : shownIds.map((id) => ({
          id,
          initial: '',
          name: '',
          color: PLACEHOLDER,
          workouts: [],
        }))),
  ];
  const rowDays = rows.map((row) => byDay(row.workouts));
  const userId = useUserId();
  const social = useContext(PlanSocialContext);
  const ownPlans = rows.flatMap((row) => row.plans ?? []);
  const peopleOf = social.usePlanPeople(ownPlans);
  const personOf = (row: LogRow) => (row.id === 'me' ? userId : row.id);
  // A shared date shows in the line of everyone taking part (the day sheet lists it once).
  const rowPlans = rows.map((row) =>
    plansByDay([
      ...(row.plans ?? []),
      ...ownPlans.filter(
        (plan) =>
          plan.userId !== personOf(row) &&
          peopleOf(plan).some((p) => p.id === personOf(row) && p.answer !== 'declined'),
      ),
    ]),
  );
  const ownPlansByRow = rows.map((row) => plansByDay(row.plans));

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
      setPast((count) => count + STEP_WEEKS);
    }
    // Near the bottom: append later weeks (nothing above moves, so no correction needed).
    if (element.scrollTop + element.clientHeight > element.scrollHeight - LOAD_MARGIN_PX) {
      setFuture((count) => count + STEP_WEEKS);
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

  const dayEntries = day
    ? rows.flatMap((row, index) =>
        (rowDays[index]?.get(day) ?? []).map((workout) => ({ row, workout })),
      )
    : [];
  const dayPlans = day
    ? rows.flatMap((row, index) =>
        (ownPlansByRow[index]?.get(day) ?? []).map((plan) => ({ row, plan })),
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
          className="relative no-scrollbar overflow-y-auto overscroll-none px-1.5"
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
                    planMap={rowPlans[rowIndex] ?? new Map<string, PlanOccurrence[]>()}
                    personId={personOf(row)}
                    peopleOf={peopleOf}
                    onOpen={onOpen}
                    onDay={setDay}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <DaySheet
        day={day}
        entries={dayEntries}
        plans={dayPlans}
        showNames
        peopleOf={peopleOf}
        onClose={() => {
          setDay(null);
        }}
      />
    </div>
  );
}

function PersonWeek({
  row,
  days,
  map,
  planMap,
  personId,
  peopleOf,
  onOpen,
  onDay,
}: {
  row: LogRow;
  days: Date[];
  map: Map<string, CalendarWorkout[]>;
  planMap: Map<string, PlanOccurrence[]>;
  personId: string;
  peopleOf: (plan: PlanOccurrence) => PlanPerson[];
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
        const plans = planMap.get(key) ?? [];
        const first = workouts[0];
        // Empty: the whole cell opens the day (like the date above), e.g. to plan.
        if (!first && plans.length === 0) {
          return (
            <button
              key={key}
              type="button"
              aria-label={`${row.name}, ${dayTitle.format(date)}`}
              onClick={() => {
                onDay(key);
              }}
              className="min-h-tap rounded-sm active:bg-surface-3"
            />
          );
        }
        return (
          <button
            key={key}
            type="button"
            aria-label={`${row.name}, ${dayTitle.format(date)}`}
            onClick={() => {
              // One workout opens it; several (or plans) show the day.
              if (first && workouts.length === 1 && plans.length === 0) onOpen(first.id);
              else onDay(key);
            }}
            className="flex min-h-tap min-w-0 items-center justify-center rounded-sm active:bg-surface-3"
            style={{ color: row.color }}
          >
            <DayMarks
              workouts={workouts}
              plans={plans}
              tinted
              personId={personId}
              peopleOf={peopleOf}
            />
          </button>
        );
      })}
    </div>
  );
}
