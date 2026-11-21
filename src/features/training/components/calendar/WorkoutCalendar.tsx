import { useContext, useState } from 'react';
import { cn } from '@/shared/lib';
import { SegmentedControl } from '@/shared/ui';
import { useWorkoutsInRange } from '../../api/useCalendar';
import {
  addDays,
  addMonths,
  dayKey,
  isoWeek,
  monthGrid,
  startOfDay,
  visibleRange,
  weekDays,
  type CalendarView,
} from '../../calendar';
import type { CalendarWorkout } from '../../types';
import { WorkoutDetailSheet } from '../workout-detail/WorkoutDetailSheet';
import { CalendarPeopleContext } from './people';
import { workoutSubtitle, workoutTitle } from './workoutText';

interface Entry {
  workout: CalendarWorkout;
  /** Someone else's workout ("Alle"); null for mine. */
  person: { name: string; color: string } | null;
  color: string;
}

const ACCENT = 'var(--color-accent)';
const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MAX_DOTS = 3;
const VIEW_KEY = 'training.calendar.view';

const monthTitle = new Intl.DateTimeFormat('de', { month: 'long', year: 'numeric' });
const dayTitle = new Intl.DateTimeFormat('de', { weekday: 'long', day: 'numeric', month: 'long' });
const shortDay = new Intl.DateTimeFormat('de', { day: 'numeric', month: 'short' });

function readView(): CalendarView {
  try {
    return localStorage.getItem(VIEW_KEY) === 'week' ? 'week' : 'month';
  } catch {
    return 'month';
  }
}

/**
 * Month or week of finished workouts (mine, or everyone's I can see), with the day's
 * workouts below. Planned appointments join later as a second source of day entries.
 */
export function WorkoutCalendar() {
  const [view, setView] = useState<CalendarView>(readView);
  const [selected, setSelected] = useState(() => startOfDay(new Date()));
  const [scope, setScope] = useState<'me' | 'all'>('me');
  const [openId, setOpenId] = useState<string | null>(null);
  const [today] = useState(() => dayKey(new Date()));
  const [now] = useState(() => Date.now());

  const range = visibleRange(view, selected);
  const mine = useWorkoutsInRange(range).data ?? [];
  const usePeople = useContext(CalendarPeopleContext);
  const others = usePeople(range, scope === 'all');
  const showAll = scope === 'all' && others.available;
  const myColor = showAll && others.myColor ? others.myColor : ACCENT;

  const entries: Entry[] = [
    ...mine.map((workout) => ({ workout, person: null, color: myColor })),
    ...(showAll
      ? others.people.flatMap((person) =>
          person.workouts.map((workout) => ({
            workout,
            person: { name: person.name, color: person.color },
            color: person.color,
          })),
        )
      : []),
  ].sort((a, b) => a.workout.startedAt.localeCompare(b.workout.startedAt));
  const byDay = new Map<string, Entry[]>();
  for (const entry of entries) {
    const key = dayKey(new Date(entry.workout.startedAt));
    byDay.set(key, [...(byDay.get(key) ?? []), entry]);
  }

  function changeView(next: CalendarView) {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Remembering the view is a convenience only.
    }
  }

  function step(direction: -1 | 1) {
    setSelected((current) =>
      view === 'month' ? addMonths(current, direction) : addDays(current, 7 * direction),
    );
  }

  const week = weekDays(selected);
  const title =
    view === 'month'
      ? monthTitle.format(selected)
      : `KW ${String(isoWeek(selected))} · ${shortDay.format(week[0] ?? selected)} – ${shortDay.format(week[6] ?? selected)}`;
  const isCurrent = range.from.getTime() <= now && now < range.to.getTime();

  return (
    <div className="flex flex-col gap-4">
      <div className={cn('grid gap-2', others.available ? 'grid-cols-2' : 'grid-cols-1')}>
        <SegmentedControl
          label="Ansicht"
          value={view}
          onChange={changeView}
          options={[
            { value: 'month', label: 'Monat' },
            { value: 'week', label: 'Woche' },
          ]}
        />
        {others.available && (
          <SegmentedControl
            label="Wessen Trainings"
            value={scope}
            onChange={setScope}
            options={[
              { value: 'me', label: 'Nur ich' },
              { value: 'all', label: 'Alle' },
            ]}
          />
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label={view === 'month' ? 'Vorheriger Monat' : 'Vorherige Woche'}
          onClick={() => {
            step(-1);
          }}
          className="flex size-tap items-center justify-center rounded-pill text-title-3 text-accent active:bg-surface-2"
        >
          ‹
        </button>
        {/* "Heute" sits beside the title, so the header never changes height. */}
        <div className="flex min-w-0 items-center gap-1">
          <h2 className="truncate text-body font-semibold capitalize">{title}</h2>
          {!isCurrent && (
            <button
              type="button"
              onClick={() => {
                setSelected(startOfDay(new Date()));
              }}
              className="min-h-tap shrink-0 px-2 text-footnote font-semibold text-accent"
            >
              Heute
            </button>
          )}
        </div>
        <button
          type="button"
          aria-label={view === 'month' ? 'Nächster Monat' : 'Nächste Woche'}
          onClick={() => {
            step(1);
          }}
          className="flex size-tap items-center justify-center rounded-pill text-title-3 text-accent active:bg-surface-2"
        >
          ›
        </button>
      </div>

      {view === 'month' ? (
        <>
          <MonthGrid
            date={selected}
            today={today}
            selectedKey={dayKey(selected)}
            byDay={byDay}
            onSelect={setSelected}
          />
          <DayEntries
            date={selected}
            entries={byDay.get(dayKey(selected)) ?? []}
            onOpen={setOpenId}
          />
        </>
      ) : (
        <div className="flex flex-col gap-3">
          {week.map((day) => (
            <DayEntries
              key={dayKey(day)}
              date={day}
              highlight={dayKey(day) === today}
              entries={byDay.get(dayKey(day)) ?? []}
              onOpen={setOpenId}
              compact
            />
          ))}
        </div>
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

function MonthGrid({
  date,
  today,
  selectedKey,
  byDay,
  onSelect,
}: {
  date: Date;
  today: string;
  selectedKey: string;
  byDay: Map<string, Entry[]>;
  onSelect: (date: Date) => void;
}) {
  const month = date.getMonth();
  return (
    <div role="grid" aria-label="Monat" className="flex flex-col gap-1">
      <div role="row" className="grid grid-cols-7">
        {WEEKDAYS.map((weekday) => (
          <span
            key={weekday}
            role="columnheader"
            className="text-center text-caption font-medium text-text-subtle"
          >
            {weekday}
          </span>
        ))}
      </div>
      {monthGrid(date).map((week) => (
        <div key={dayKey(week[0] ?? date)} role="row" className="grid grid-cols-7">
          {week.map((day) => {
            const key = dayKey(day);
            const entries = byDay.get(key) ?? [];
            const isSelected = key === selectedKey;
            const isToday = key === today;
            return (
              <button
                key={key}
                type="button"
                role="gridcell"
                aria-selected={isSelected}
                aria-label={`${dayTitle.format(day)}, ${
                  entries.length === 0
                    ? 'kein Training'
                    : entries.length === 1
                      ? '1 Training'
                      : `${String(entries.length)} Trainings`
                }`}
                onClick={() => {
                  onSelect(day);
                }}
                className={cn(
                  'flex min-h-tap flex-col items-center justify-center gap-1 rounded-card py-1.5',
                  isSelected ? 'bg-surface-3' : 'active:bg-surface-2',
                )}
              >
                <span
                  className={cn(
                    'flex size-7 items-center justify-center rounded-pill text-subhead tabular-nums',
                    day.getMonth() !== month && 'text-text-subtle',
                    isToday && 'bg-accent font-semibold text-on-accent',
                  )}
                >
                  {day.getDate()}
                </span>
                <span aria-hidden className="flex h-1.5 items-center gap-0.5">
                  {entries.slice(0, MAX_DOTS).map((entry) => (
                    <span
                      key={entry.workout.id}
                      className="size-1.5 rounded-pill"
                      style={{ backgroundColor: entry.color }}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function DayEntries({
  date,
  entries,
  onOpen,
  compact = false,
  highlight = false,
}: {
  date: Date;
  entries: Entry[];
  onOpen: (workoutId: string) => void;
  /** Week view: empty days as one quiet line. */
  compact?: boolean;
  highlight?: boolean;
}) {
  const heading = (
    <h3
      className={cn('text-footnote font-semibold', highlight ? 'text-accent' : 'text-text-muted')}
    >
      {dayTitle.format(date)}
    </h3>
  );
  // Week view: empty days take a single quiet line.
  if (compact && entries.length === 0) {
    return (
      <section className="flex items-baseline justify-between gap-3">
        {heading}
        <span className="text-footnote text-text-subtle">–</span>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-1.5">
      {heading}
      {entries.length === 0 ? (
        <p className="text-footnote text-text-subtle">Kein Training.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {entries.map((entry) => (
            <li key={entry.workout.id}>
              <button
                type="button"
                onClick={() => {
                  onOpen(entry.workout.id);
                }}
                className="flex min-h-tap w-full items-center gap-3 rounded-card bg-surface-2 px-4 py-2.5 text-left active:bg-surface-3"
              >
                <span
                  aria-hidden
                  className="h-8 w-1 shrink-0 rounded-pill"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-subhead font-semibold">
                    {entry.person && (
                      <span className="text-text-muted">{entry.person.name} · </span>
                    )}
                    {workoutTitle(entry.workout)}
                  </span>
                  <span className="truncate text-footnote text-text-muted">
                    {workoutSubtitle(entry.workout)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
