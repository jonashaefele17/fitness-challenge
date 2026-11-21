import { useContext, useRef, useState, type PointerEvent } from 'react';
import { cn } from '@/shared/lib';
import { ChevronLeftIcon, ChevronRightIcon } from '@/shared/ui';
import { useWorkoutsInRange } from '../../api/useCalendar';
import {
  addDays,
  addMonths,
  dayKey,
  isoWeek,
  monthWeeks,
  startOfDay,
  startOfMonth,
} from '../../calendar';
import type { CalendarWorkout } from '../../types';
import { TrainingTypeIcon } from '../TrainingTypeIcon';
import { WorkoutDetailSheet } from '../workout-detail/WorkoutDetailSheet';
import { CalendarPeopleContext } from './people';
import { cellLabel, workoutSubtitle, workoutTitle } from './workoutText';

const ACCENT = 'var(--color-accent)';
const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const ALL_KEY = 'training.log.all';
/** Horizontal finger travel (px) that flips the month. */
const SWIPE_PX = 60;
const GRID = 'grid grid-cols-[2rem_repeat(7,minmax(0,1fr))_2rem]';

const monthTitle = new Intl.DateTimeFormat('de', { month: 'long', year: 'numeric' });
const dayTitle = new Intl.DateTimeFormat('de', { weekday: 'long', day: 'numeric', month: 'long' });

interface Row {
  id: string;
  initial: string;
  name: string;
  color: string;
  workouts: CalendarWorkout[];
}

function readAll(): boolean {
  try {
    return localStorage.getItem(ALL_KEY) === '1';
  } catch {
    return false;
  }
}

/** Strength first (it shapes the training plan), then by time. */
function forPlan(workouts: CalendarWorkout[]): CalendarWorkout[] {
  return [...workouts].sort(
    (a, b) =>
      Number(b.trainingType.kind === 'exercises') - Number(a.trainingType.kind === 'exercises') ||
      a.startedAt.localeCompare(b.startedAt),
  );
}

function byDay(workouts: CalendarWorkout[]): Map<string, CalendarWorkout[]> {
  const map = new Map<string, CalendarWorkout[]>();
  for (const workout of workouts) {
    const key = dayKey(new Date(workout.startedAt));
    map.set(key, [...(map.get(key) ?? []), workout]);
  }
  for (const [key, list] of map) map.set(key, forPlan(list));
  return map;
}

function sameMonth(a: Date, b: Date): boolean {
  return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

/**
 * One month as a card: weeks as rows, each day shows what was trained (type icon plus
 * focus or distance). "Gruppe" adds a row per person to every week. Tap a date for the
 * day below the card, a workout to open it; swipe or use the arrows for other months.
 */
export function WorkoutLog() {
  const [today] = useState(() => startOfDay(new Date()));
  const [month, setMonth] = useState(() => startOfMonth(today));
  const [selected, setSelected] = useState<string | null>(() => dayKey(today));
  const [all, setAll] = useState(readAll);
  const [openId, setOpenId] = useState<string | null>(null);
  const swipe = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const mondays = monthWeeks(month);
  const range = { from: mondays[0] ?? month, to: addDays(mondays.at(-1) ?? month, 7) };
  const mine = useWorkoutsInRange(range).data ?? [];
  const usePeople = useContext(CalendarPeopleContext);
  const others = usePeople(range, all);
  const showAll = all && others.available;

  const rows: Row[] = [
    {
      id: 'me',
      initial: (others.myName ?? 'Du').charAt(0).toUpperCase(),
      name: 'Du',
      color: showAll && others.myColor ? others.myColor : ACCENT,
      workouts: mine,
    },
    ...(showAll
      ? others.people.map((person) => ({
          id: person.id,
          initial: person.name.charAt(0).toUpperCase(),
          name: person.name,
          color: person.color,
          workouts: person.workouts,
        }))
      : []),
  ];
  const rowDays = rows.map((row) => byDay(row.workouts));

  function showMonth(next: Date) {
    setMonth(next);
    setSelected(sameMonth(next, today) ? dayKey(today) : null);
  }

  function toggleAll() {
    setAll((on) => {
      try {
        localStorage.setItem(ALL_KEY, on ? '0' : '1');
      } catch {
        // Remembering the filter is a convenience only.
      }
      return !on;
    });
  }

  function onPointerDown(event: PointerEvent) {
    swipe.current = { x: event.clientX, y: event.clientY, moved: false };
  }
  function onPointerUp(event: PointerEvent) {
    const start = swipe.current;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
      start.moved = true;
      showMonth(addMonths(month, dx < 0 ? 1 : -1));
    }
  }

  const selectedDate = selected ? new Date(`${selected}T00:00:00`) : null;
  const dayEntries = selected
    ? rows.flatMap((row, index) =>
        (rowDays[index]?.get(selected) ?? []).map((workout) => ({ row, workout })),
      )
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center">
          <button
            type="button"
            aria-label="Vorheriger Monat"
            onClick={() => {
              showMonth(addMonths(month, -1));
            }}
            className="flex size-tap shrink-0 items-center justify-center rounded-pill text-title-3 text-accent active:bg-surface-2"
          >
            <ChevronLeftIcon />
          </button>
          <h2 className="min-w-0 truncate text-body font-semibold capitalize">
            {monthTitle.format(month)}
          </h2>
          <button
            type="button"
            aria-label="Nächster Monat"
            onClick={() => {
              showMonth(addMonths(month, 1));
            }}
            className="flex size-tap shrink-0 items-center justify-center rounded-pill text-title-3 text-accent active:bg-surface-2"
          >
            <ChevronRightIcon />
          </button>
          {!sameMonth(month, today) && (
            <button
              type="button"
              onClick={() => {
                showMonth(startOfMonth(today));
              }}
              className="min-h-tap shrink-0 px-1 text-footnote font-semibold text-accent"
            >
              Heute
            </button>
          )}
        </div>
        {others.available && (
          <button
            type="button"
            aria-pressed={all}
            onClick={toggleAll}
            className={cn(
              'flex min-h-tap shrink-0 items-center gap-2 rounded-pill border px-3 text-subhead font-semibold',
              all ? 'border-text-muted bg-surface-3' : 'border-border bg-surface-2',
            )}
          >
            <span aria-hidden className="flex -space-x-1.5">
              {others.people.slice(0, 4).map((person) => (
                <span
                  key={person.id}
                  className="size-5 rounded-pill border-2 border-surface-2"
                  style={{ backgroundColor: person.color }}
                />
              ))}
            </span>
            Gruppe
          </button>
        )}
      </div>

      <div
        className="flex touch-pan-y flex-col rounded-card bg-surface-2 px-2 py-2"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onClickCapture={(event) => {
          // A swipe must not also tap the cell it started on.
          if (swipe.current?.moved) {
            event.stopPropagation();
            swipe.current = null;
          }
        }}
      >
        <div aria-hidden className={cn(GRID, 'text-center text-caption text-text-subtle')}>
          <span />
          {WEEKDAYS.map((weekday) => (
            <span key={weekday}>{weekday}</span>
          ))}
          <span />
        </div>
        {mondays.map((monday, index) => (
          <Week
            key={dayKey(monday)}
            monday={monday}
            month={month}
            today={today}
            selected={selected}
            rows={rows}
            rowDays={rowDays}
            showAvatars={showAll}
            divider={index > 0}
            onSelectDay={setSelected}
            onOpen={setOpenId}
          />
        ))}
      </div>

      {selectedDate ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-footnote font-semibold text-text-muted">
            {dayTitle.format(selectedDate)}
          </h3>
          {dayEntries.length === 0 ? (
            <p className="text-footnote text-text-subtle">Kein Training.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {dayEntries.map(({ row, workout }) => (
                <li key={workout.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenId(workout.id);
                    }}
                    className="flex min-h-tap w-full items-center gap-3 rounded-card bg-surface-2 px-4 py-3 text-left active:bg-surface-3"
                  >
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-surface-3"
                      style={{ color: row.color }}
                    >
                      <TrainingTypeIcon icon={workout.trainingType.icon} className="size-5" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-subhead font-semibold">
                        {showAll && <span className="text-text-muted">{row.name} · </span>}
                        {workoutTitle(workout)}
                      </span>
                      <span className="truncate text-footnote text-text-muted">
                        {workoutSubtitle(workout)}
                      </span>
                    </span>
                    <ChevronRightIcon aria-hidden className="shrink-0 text-text-subtle" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <p className="text-footnote text-text-subtle">Tippe auf ein Datum, um den Tag zu sehen.</p>
      )}

      <WorkoutDetailSheet
        workoutId={openId}
        onClose={() => {
          setOpenId(null);
        }}
      />
    </div>
  );
}

function Week({
  monday,
  month,
  today,
  selected,
  rows,
  rowDays,
  showAvatars,
  divider,
  onSelectDay,
  onOpen,
}: {
  monday: Date;
  month: Date;
  today: Date;
  selected: string | null;
  rows: Row[];
  rowDays: Map<string, CalendarWorkout[]>[];
  showAvatars: boolean;
  divider: boolean;
  onSelectDay: (key: string) => void;
  onOpen: (workoutId: string) => void;
}) {
  const days = Array.from({ length: 7 }, (_, index) => addDays(monday, index));
  const todayKey = dayKey(today);
  return (
    <div className={cn('flex flex-col gap-0.5 py-1.5', divider && 'border-t border-border')}>
      <div className={cn(GRID, 'items-center text-center text-caption tabular-nums')}>
        <span className="text-left text-text-subtle">{isoWeek(monday)}</span>
        {days.map((day) => {
          const key = dayKey(day);
          const outside = day.getMonth() !== month.getMonth();
          return (
            <button
              key={key}
              type="button"
              aria-label={dayTitle.format(day)}
              aria-pressed={key === selected}
              onClick={() => {
                onSelectDay(key);
              }}
              className="flex min-h-tap items-center justify-center"
            >
              <span
                className={cn(
                  'flex size-6 items-center justify-center rounded-pill',
                  key === todayKey
                    ? 'bg-accent font-semibold text-on-accent'
                    : key === selected
                      ? 'bg-surface-3 font-semibold text-text'
                      : outside || day > today
                        ? 'text-text-subtle'
                        : 'text-text-muted',
                  key === selected && key === todayKey && 'ring-2 ring-text',
                )}
              >
                {day.getDate()}
              </span>
            </button>
          );
        })}
        <span />
      </div>
      {rows.map((row, rowIndex) => {
        const map = rowDays[rowIndex] ?? new Map<string, CalendarWorkout[]>();
        const count = days.reduce((sum, day) => sum + (map.get(dayKey(day))?.length ?? 0), 0);
        return (
          <div key={row.id} className={cn(GRID, 'items-center')}>
            {showAvatars ? (
              <span
                aria-label={row.name}
                className="flex size-6 items-center justify-center rounded-pill text-caption font-semibold text-on-accent"
                style={{ backgroundColor: row.color }}
              >
                {row.initial}
              </span>
            ) : (
              <span />
            )}
            {days.map((day) => {
              const key = dayKey(day);
              const workouts = map.get(key) ?? [];
              const [first, second] = workouts;
              if (!first) return <span key={key} className="min-h-tap" />;
              const label =
                cellLabel(first) || (workouts.length > 1 ? `${String(workouts.length)}×` : '');
              return (
                <button
                  key={key}
                  type="button"
                  aria-label={`${row.name}, ${dayTitle.format(day)}: ${workouts.map(workoutTitle).join(', ')}`}
                  onClick={() => {
                    // One workout opens it; several show the day below the card.
                    if (workouts.length === 1) onOpen(first.id);
                    else onSelectDay(key);
                  }}
                  className={cn(
                    'flex min-h-tap min-w-0 flex-col items-center justify-center gap-0.5 rounded-sm active:bg-surface-3',
                    day.getMonth() !== month.getMonth() && 'opacity-50',
                  )}
                  style={{ color: row.color }}
                >
                  <span className="flex items-center gap-0.5">
                    <TrainingTypeIcon
                      icon={first.trainingType.icon}
                      className={second ? 'size-4' : 'size-5'}
                    />
                    {second && (
                      <TrainingTypeIcon
                        icon={second.trainingType.icon}
                        className="size-3 opacity-70"
                      />
                    )}
                    {workouts.length > 2 && (
                      <span className="text-caption leading-none">+{workouts.length - 2}</span>
                    )}
                  </span>
                  {/* Quiet grey label: the icon leads, the text only explains. */}
                  <span className="max-w-full truncate text-caption leading-none text-text-muted">
                    {label}
                  </span>
                </button>
              );
            })}
            <span className="text-right text-caption text-text-subtle tabular-nums">
              {count > 0 ? `${String(count)}×` : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}
