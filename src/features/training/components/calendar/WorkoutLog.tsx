import { useContext, useState } from 'react';
import { cn } from '@/shared/lib';
import { Button, Sheet } from '@/shared/ui';
import { useWorkoutsInRange } from '../../api/useCalendar';
import { addDays, dayKey, isoWeek, startOfDay, startOfWeek } from '../../calendar';
import type { CalendarWorkout } from '../../types';
import { TrainingTypeIcon } from '../TrainingTypeIcon';
import { WorkoutDetailSheet } from '../workout-detail/WorkoutDetailSheet';
import { CalendarPeopleContext } from './people';
import { cellLabel, workoutSubtitle, workoutTitle } from './workoutText';

const WEEKS_PER_PAGE = 8;
const ACCENT = 'var(--color-accent)';
const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const ALL_KEY = 'training.log.all';

const monthTitle = new Intl.DateTimeFormat('de', { month: 'long', year: 'numeric' });
const dayTitle = new Intl.DateTimeFormat('de', { weekday: 'long', day: 'numeric', month: 'long' });

interface Row {
  id: string;
  /** Initial shown in the avatar column ("Alle" only). */
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

/**
 * Training log: weeks as rows (newest first), each day shows what was trained (icon of the
 * training type, focus or distance). With "Alle" every week becomes a small table with one
 * row per person, so you see who trained what and when. Scroll down for older weeks.
 */
export function WorkoutLog() {
  const [today] = useState(() => startOfDay(new Date()));
  const [weeks, setWeeks] = useState(WEEKS_PER_PAGE);
  const [all, setAll] = useState(readAll);
  const [openId, setOpenId] = useState<string | null>(null);
  const [dayPick, setDayPick] = useState<{ date: Date; workouts: CalendarWorkout[] } | null>(null);

  const thisMonday = startOfWeek(today);
  const range = { from: addDays(thisMonday, -7 * (weeks - 1)), to: addDays(thisMonday, 7) };
  const mine = useWorkoutsInRange(range);
  const usePeople = useContext(CalendarPeopleContext);
  const others = usePeople(range, all);
  const showAll = all && others.available;

  const rows: Row[] = [
    {
      id: 'me',
      initial: (others.myName ?? 'Du').charAt(0).toUpperCase(),
      name: 'Du',
      color: showAll && others.myColor ? others.myColor : ACCENT,
      workouts: mine.data ?? [],
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

  // Newest week first, grouped by month (a week belongs to the month of its Thursday).
  const mondays = Array.from({ length: weeks }, (_, index) => addDays(thisMonday, -7 * index));
  const months: { key: string; title: string; mondays: Date[] }[] = [];
  for (const monday of mondays) {
    const thursday = addDays(monday, 3);
    const key = `${String(thursday.getFullYear())}-${String(thursday.getMonth())}`;
    const last = months.at(-1);
    if (last?.key === key) last.mondays.push(monday);
    else months.push({ key, title: monthTitle.format(thursday), mondays: [monday] });
  }

  function openCell(date: Date, workouts: CalendarWorkout[]) {
    if (workouts.length === 1 && workouts[0]) setOpenId(workouts[0].id);
    else if (workouts.length > 1) setDayPick({ date, workouts });
  }

  return (
    <div className="flex flex-col gap-4">
      {others.available && (
        <div className="flex justify-end">
          <button
            type="button"
            aria-pressed={all}
            onClick={toggleAll}
            className={cn(
              'flex min-h-tap items-center gap-2 rounded-pill border px-3 text-subhead font-semibold',
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
            Gruppe {all ? 'an' : 'aus'}
          </button>
        </div>
      )}

      {months.map((month) => (
        <section key={month.key} className="flex flex-col gap-2">
          <h2 className="text-subhead font-semibold text-text-muted capitalize">{month.title}</h2>
          <div className="flex flex-col rounded-card bg-surface-2 px-2 py-2">
            <div
              aria-hidden
              className="grid grid-cols-[2rem_repeat(7,minmax(0,1fr))_2rem] text-center text-caption text-text-subtle"
            >
              <span />
              {WEEKDAYS.map((weekday) => (
                <span key={weekday}>{weekday}</span>
              ))}
              <span />
            </div>
            {month.mondays.map((monday, index) => (
              <Week
                key={dayKey(monday)}
                monday={monday}
                today={today}
                rows={rows}
                compact={showAll}
                divider={index > 0}
                onOpen={openCell}
              />
            ))}
          </div>
        </section>
      ))}

      <Button
        variant="secondary"
        loading={mine.isFetching}
        onClick={() => {
          setWeeks((count) => count + WEEKS_PER_PAGE);
        }}
      >
        Ältere Wochen
      </Button>

      <Sheet
        open={dayPick !== null}
        onOpenChange={(open) => {
          if (!open) setDayPick(null);
        }}
        title={dayPick ? dayTitle.format(dayPick.date) : 'Trainings'}
      >
        <ul className="flex flex-col gap-2">
          {dayPick?.workouts.map((workout) => (
            <li key={workout.id}>
              <button
                type="button"
                onClick={() => {
                  setDayPick(null);
                  setOpenId(workout.id);
                }}
                className="flex min-h-tap w-full items-center gap-3 rounded-card bg-surface-2 px-4 py-3 text-left active:bg-surface-3"
              >
                <TrainingTypeIcon icon={workout.trainingType.icon} className="size-6 shrink-0" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-subhead font-semibold">
                    {workoutTitle(workout)}
                  </span>
                  <span className="truncate text-footnote text-text-muted">
                    {workoutSubtitle(workout)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

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
  today,
  rows,
  compact,
  divider,
  onOpen,
}: {
  monday: Date;
  today: Date;
  rows: Row[];
  /** Several people: avatars in the first column. */
  compact: boolean;
  divider: boolean;
  onOpen: (date: Date, workouts: CalendarWorkout[]) => void;
}) {
  const days = Array.from({ length: 7 }, (_, index) => addDays(monday, index));
  const todayKey = dayKey(today);
  return (
    <div className={cn('flex flex-col gap-0.5 py-1.5', divider && 'border-t border-border')}>
      <div className="grid grid-cols-[2rem_repeat(7,minmax(0,1fr))_2rem] items-center text-center text-caption tabular-nums">
        <span className="text-left text-text-subtle">{isoWeek(monday)}</span>
        {days.map((day) => (
          <span key={dayKey(day)} className="flex justify-center">
            <span
              className={cn(
                'flex size-5 items-center justify-center rounded-pill',
                dayKey(day) === todayKey
                  ? 'bg-accent font-semibold text-on-accent'
                  : day > today
                    ? 'text-text-subtle'
                    : 'text-text-muted',
              )}
            >
              {day.getDate()}
            </span>
          </span>
        ))}
        <span />
      </div>
      {rows.map((row) => {
        const byDay = new Map<string, CalendarWorkout[]>();
        for (const workout of row.workouts) {
          const key = dayKey(new Date(workout.startedAt));
          byDay.set(key, [...(byDay.get(key) ?? []), workout]);
        }
        const count = days.reduce((sum, day) => sum + (byDay.get(dayKey(day))?.length ?? 0), 0);
        return (
          <div
            key={row.id}
            className="grid grid-cols-[2rem_repeat(7,minmax(0,1fr))_2rem] items-center"
          >
            {compact ? (
              <span
                aria-label={row.name}
                className="flex size-6 items-center justify-center rounded-pill text-caption font-semibold text-on-accent"
                style={{ backgroundColor: row.color }}
              >
                {row.initial.charAt(0)}
              </span>
            ) : (
              <span />
            )}
            {days.map((day) => {
              const workouts = byDay.get(dayKey(day)) ?? [];
              const first = workouts[0];
              if (!first) return <span key={dayKey(day)} className="min-h-tap" />;
              return (
                <button
                  key={dayKey(day)}
                  type="button"
                  aria-label={`${row.name}, ${dayTitle.format(day)}: ${workouts.map(workoutTitle).join(', ')}`}
                  onClick={() => {
                    onOpen(day, workouts);
                  }}
                  className="flex min-h-tap min-w-0 flex-col items-center justify-center gap-0.5 rounded-sm active:bg-surface-3"
                  style={{ color: row.color }}
                >
                  <span className="flex items-center">
                    {workouts.slice(0, 2).map((workout) => (
                      <TrainingTypeIcon
                        key={workout.id}
                        icon={workout.trainingType.icon}
                        className={workouts.length > 1 ? 'size-4' : 'size-5'}
                      />
                    ))}
                  </span>
                  <span className="max-w-full truncate text-caption leading-none font-semibold text-text">
                    {cellLabel(first)}
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
