import { useContext, useState } from 'react';
import { cn } from '@/shared/lib';
import { Button, ChevronRightIcon, SegmentedControl, Sheet } from '@/shared/ui';
import { useHabitDays, useHabitSummary, useHabitWeeks, useMyHabits } from '../api/useHabits';
import { cellClass, mondayOf, percent } from '../cells';
import { HabitCompareContext } from '../compare';
import { figures, trend } from '../figures';
import { addDays, todayKey } from '../dates';
import type { Habit, HabitWeek } from '../types';
import {
  HabitChecklistShare,
  HabitHeatmap,
  HabitLine,
  HabitNights,
  HabitWeekBars,
} from './HabitCharts';
import { HabitCompareView } from './HabitCompareView';
import { HabitsSettings } from './HabitsSettings';

type Range = '4w' | '3m';

/**
 * Ich → Habits, as in the prototype: this week (a row per habit, Monday to Sunday and
 * "5/7"), sticking with it over 4 weeks (small squares, share and trend); a tap opens the
 * habit with its figures in plain words and its chart. Managing the habits is one tap away.
 */
export function HabitsOverview() {
  const [today] = useState(todayKey);
  const all = useMyHabits().data ?? [];
  const habits = all.filter((h) => !h.archived);
  const archived = all.filter((h) => h.archived);
  const [managing, setManaging] = useState(false);
  const [open, setOpen] = useState<Habit | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {habits.length === 0 ? (
        <p className="text-subhead text-text-muted">
          Noch keine Habits. Leg 3 bis 7 an, dann siehst du hier, wie es läuft.
        </p>
      ) : (
        <>
          <ThisWeek habits={habits} today={today} onOpen={setOpen} />
          <StickingWithIt habits={habits} today={today} onOpen={setOpen} />
        </>
      )}
      {archived.length > 0 && (
        <details className="rounded-card bg-surface-2 px-4">
          <summary className="flex min-h-tap cursor-pointer items-center text-subhead font-semibold text-text-muted">
            Archiviert ({archived.length})
          </summary>
          <ul className="flex flex-col pb-2">
            {archived.map((habit) => (
              <li key={habit.id}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(habit);
                  }}
                  className="flex min-h-tap w-full items-center justify-between gap-3 text-left text-subhead active:bg-surface-3"
                >
                  <span className="truncate">{habit.current.name}</span>
                  <ChevronRightIcon aria-hidden className="shrink-0 text-text-subtle" />
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      <Button
        variant="tinted"
        onClick={() => {
          setManaging(true);
        }}
      >
        Habits verwalten
      </Button>

      <Sheet open={managing} onOpenChange={setManaging} title="Habits verwalten">
        <HabitsSettings />
      </Sheet>
      <HabitDetailSheet
        habit={open}
        today={today}
        onClose={() => {
          setOpen(null);
        }}
      />
    </div>
  );
}

const LETTERS = ['M', 'D', 'M', 'D', 'F', 'S', 'S'];

/** "Diese Woche": per habit Monday to Sunday and "5/7" (weekly goals: "3/4"). */
function ThisWeek({
  habits,
  today,
  onOpen,
}: {
  habits: Habit[];
  today: string;
  onOpen: (habit: Habit) => void;
}) {
  const monday = mondayOf(today);
  const sunday = addDays(monday, 6);
  const days = useHabitDays(monday, sunday).data ?? [];
  const weeks = useHabitWeeks(monday, sunday).data ?? [];
  const lastMonday = addDays(monday, -7);
  const last = useHabitSummary(lastMonday, addDays(lastMonday, 6)).data ?? [];
  const lastMet = last.reduce((sum, s) => sum + s.met, 0);
  const lastCounted = last.reduce((sum, s) => sum + s.counted, 0);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  return (
    <section className="flex flex-col gap-3 rounded-card bg-surface-2 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-body font-semibold">Diese Woche</h2>
        {lastCounted > 0 && (
          <span className="text-footnote text-text-muted">
            letzte: {lastMet} von {lastCounted}
          </span>
        )}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-2">
        <span />
        <span className="grid grid-cols-7 gap-1">
          {LETTERS.map((letter, i) => (
            <span
              key={dates[i]}
              className={cn(
                'w-5 text-center text-caption',
                dates[i] === today ? 'text-accent' : 'text-text-muted',
              )}
            >
              {letter}
            </span>
          ))}
        </span>
        <span />
        {habits.map((habit) => {
          const own = days.filter((d) => d.habitId === habit.id);
          const week = weeks.find((w) => w.habitId === habit.id);
          const weekly = habit.current.frequency === 'weekly';
          const counted = own.filter(
            (d) => d.state === 'done' || d.state === 'partial' || d.state === 'missed',
          );
          const ratio = weekly
            ? `${String(week?.doneDays ?? 0)}/${String(week?.target ?? habit.current.timesPerWeek ?? 0)}`
            : `${String(own.filter((d) => d.state === 'done').length)}/${String(counted.length)}`;
          return (
            <button
              key={habit.id}
              type="button"
              onClick={() => {
                onOpen(habit);
              }}
              className="col-span-3 grid grid-cols-subgrid items-center rounded-sm py-1 text-left active:bg-surface-3"
            >
              <span className="truncate text-subhead font-semibold">{habit.current.name}</span>
              <span className="grid grid-cols-7 gap-1">
                {dates.map((date) => (
                  <span
                    key={date}
                    className={cn(
                      'size-5 rounded-sm',
                      cellClass(own.find((d) => d.onDate === date)),
                    )}
                  />
                ))}
              </span>
              <span className="w-9 text-right text-footnote text-text-muted tabular-nums">
                {ratio}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** "Dranbleiben · letzte 4 Wochen": small squares, share and trend per habit. */
function StickingWithIt({
  habits,
  today,
  onOpen,
}: {
  habits: Habit[];
  today: string;
  onOpen: (habit: Habit) => void;
}) {
  const from = addDays(today, -27);
  const days = useHabitDays(from, today).data ?? [];
  const summary = useHabitSummary(from, today).data ?? [];
  const weeks = useHabitWeeks(from, today).data ?? [];
  const dates = Array.from({ length: 28 }, (_, i) => addDays(from, i));

  return (
    <section className="flex flex-col gap-3 rounded-card bg-surface-2 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-body font-semibold">Dranbleiben</h2>
        <span className="text-footnote text-text-muted">letzte 4 Wochen</span>
      </div>
      <ul className="flex flex-col gap-2">
        {habits.map((habit) => {
          const own = days.filter((d) => d.habitId === habit.id);
          const s = summary.find((x) => x.habitId === habit.id);
          const t = trend(s);
          return (
            <li key={habit.id}>
              <button
                type="button"
                onClick={() => {
                  onOpen(habit);
                }}
                className="flex w-full flex-col gap-1.5 rounded-sm py-1 text-left active:bg-surface-3"
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-subhead font-semibold">{habit.current.name}</span>
                  <span className="flex items-center gap-1 text-footnote tabular-nums">
                    <span className="font-semibold">{percent(s?.quota ?? null)}</span>
                    {t && (
                      <span aria-label={t.label} className="text-text-muted">
                        {t.mark}
                      </span>
                    )}
                    <ChevronRightIcon aria-hidden className="text-text-subtle" />
                  </span>
                </span>
                {habit.current.frequency === 'weekly' ? (
                  <WeekSegments weeks={weeks.filter((w) => w.habitId === habit.id).slice(-4)} />
                ) : (
                  <span className="grid grid-cols-[repeat(28,minmax(0,1fr))] gap-0.5" aria-hidden>
                    {dates.map((date) => (
                      <span
                        key={date}
                        className={cn(
                          'rounded-xs h-2',
                          cellClass(own.find((d) => d.onDate === date)),
                        )}
                      />
                    ))}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Weekly goals over 4 weeks: one bar per week, filled as far as it got (1/3, 2/3 …);
 * green when met, grey when not, dashed for a week of pause.
 */
function WeekSegments({ weeks }: { weeks: HabitWeek[] }) {
  return (
    <span className="grid grid-cols-4 gap-1">
      {weeks.map((week) => (
        <span
          key={week.weekStart}
          aria-label={`${String(week.doneDays)} von ${String(week.target)}`}
          className={cn(
            'rounded-xs h-2 overflow-hidden',
            week.state === 'paused' ? 'border border-dashed border-text-subtle' : 'bg-surface-3',
          )}
        >
          {week.state !== 'paused' && (
            <span
              className={cn(
                'rounded-xs block h-full',
                week.state === 'done' ? 'bg-accent' : 'bg-text-subtle',
              )}
              style={{
                width: `${String(Math.min(100, (week.doneDays / Math.max(1, week.target)) * 100))}%`,
              }}
            />
          )}
        </span>
      ))}
    </span>
  );
}

/** One habit: three figures in plain words, then its chart; 4 weeks or 3 months. */
function HabitDetailSheet({
  habit,
  today,
  onClose,
}: {
  habit: Habit | null;
  today: string;
  onClose: () => void;
}) {
  const [range, setRange] = useState<Range>('4w');
  const from = addDays(today, range === '4w' ? -27 : -90);
  const days = (useHabitDays(from, today).data ?? []).filter((d) => d.habitId === habit?.id);
  const weeks = (useHabitWeeks(from, today).data ?? []).filter((w) => w.habitId === habit?.id);
  const summary = (useHabitSummary(from, today).data ?? []).find((s) => s.habitId === habit?.id);
  const def = habit?.current;
  const t = trend(summary);
  // Comparing with the others who keep the same habit (only with a provider from the app).
  const compare = useContext(HabitCompareContext)(habit);
  const [comparing, setComparing] = useState(false);
  const canCompare = compare.me !== null && compare.people.length > 0 && habit !== null;
  const showCompare = comparing && canCompare;

  return (
    <Sheet
      open={habit !== null}
      onOpenChange={(next) => {
        if (!next) {
          setComparing(false);
          onClose();
        }
      }}
      title={def?.name ?? 'Habit'}
    >
      {def && (
        <div className="flex flex-col gap-5 pt-1">
          <SegmentedControl
            label="Zeitraum"
            size="compact"
            value={range}
            onChange={setRange}
            options={[
              { value: '4w', label: '4 Wochen' },
              { value: '3m', label: '3 Monate' },
            ]}
          />
          {showCompare && compare.me ? (
            <HabitCompareView
              people={[{ ...compare.me, habit }, ...compare.people]}
              range={range}
              today={today}
            />
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                {figures(def, summary, weeks).map((f) => (
                  <Figure key={f.label} label={f.label} value={f.value} />
                ))}
              </div>
              {t && (
                <p className="-mt-2 text-footnote text-text-muted">
                  {t.mark} {t.label} ({range === '4w' ? 'die 4 Wochen' : 'die 3 Monate'} davor:{' '}
                  {percent(summary?.previousQuota ?? null)})
                </p>
              )}
              <div className="rounded-card bg-surface-2 p-4">
                {def.frequency === 'weekly' ? (
                  <HabitWeekBars weeks={weeks} />
                ) : def.inputType === 'number' || def.inputType === 'duration' ? (
                  <HabitLine days={days} def={def} />
                ) : def.inputType === 'time_pair' ? (
                  <HabitNights days={days} def={def} />
                ) : (
                  <HabitHeatmap days={days} def={def} from={from} to={today} />
                )}
              </div>
              {def.inputType === 'checklist' && (
                <section className="flex flex-col gap-2">
                  <h3 className="text-footnote font-semibold text-text-muted">Pro Punkt</h3>
                  <HabitChecklistShare days={days} def={def} />
                </section>
              )}
            </>
          )}
          {canCompare && (
            <Button
              variant="tinted"
              onClick={() => {
                setComparing(!comparing);
              }}
            >
              {comparing
                ? 'Nur meine Werte'
                : `Vergleichen mit ${compare.people.map((p) => p.name).join(', ')}`}
            </Button>
          )}
        </div>
      )}
    </Sheet>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-card bg-surface-2 px-3 py-2.5">
      <span className="truncate text-caption text-text-muted">{label}</span>
      <span className="truncate text-title-3 font-bold tabular-nums">{value}</span>
    </div>
  );
}
