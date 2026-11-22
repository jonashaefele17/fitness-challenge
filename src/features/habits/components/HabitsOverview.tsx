import { useState } from 'react';
import { cn } from '@/shared/lib';
import { Button, ChevronRightIcon, SegmentedControl, Sheet } from '@/shared/ui';
import { useHabitDays, useHabitStats, useHabitWeeks, useMyHabits } from '../api/useHabits';
import { addDays, todayKey } from '../dates';
import type { Habit, HabitDay, HabitStats } from '../types';
import {
  HabitChecklistShare,
  HabitHeatmap,
  HabitLine,
  HabitNights,
  HabitWeekBars,
} from './HabitCharts';
import { HabitsSettings } from './HabitsSettings';

type Range = '4w' | '3m';

/** Monday of the week a day is in. */
function mondayOf(day: string): string {
  const weekday = (new Date(`${day}T12:00:00`).getDay() + 6) % 7;
  return addDays(day, -weekday);
}

function percent(quota: number | null): string {
  return quota === null ? '–' : `${String(Math.round(quota * 100))} %`;
}

function streakText(stats: HabitStats | undefined): string {
  if (!stats || stats.currentStreak === 0) return 'keine Serie';
  const n = stats.currentStreak;
  return stats.unit === 'weeks'
    ? `${String(n)} ${n === 1 ? 'Woche' : 'Wochen'} am Stück`
    : `${String(n)} ${n === 1 ? 'Tag' : 'Tage'} am Stück`;
}

/**
 * Ich → Habits: last week at a glance, a card per habit (quota of the last 4 weeks, streak,
 * the last two weeks as dots), each opening its chart; managing the habits is one tap away.
 */
export function HabitsOverview() {
  const [today] = useState(todayKey);
  const habits = (useMyHabits().data ?? []).filter((h) => !h.archived);
  const from = addDays(today, -27);
  const stats = useHabitStats(from, today).data ?? [];
  const recent = useHabitDays(addDays(today, -13), today).data ?? [];
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
          <LastWeek habits={habits} today={today} />
          <ul className="flex flex-col gap-2">
            {habits.map((habit) => (
              <li key={habit.id}>
                <HabitCard
                  habit={habit}
                  stats={stats.find((s) => s.habitId === habit.id)}
                  days={recent.filter((d) => d.habitId === habit.id)}
                  onOpen={() => {
                    setOpen(habit);
                  }}
                />
              </li>
            ))}
          </ul>
        </>
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

/** "Letzte Woche": the share met over all habits, the best and the weakest. */
function LastWeek({ habits, today }: { habits: Habit[]; today: string }) {
  const monday = addDays(mondayOf(today), -7);
  const stats = (useHabitStats(monday, addDays(monday, 6)).data ?? []).filter(
    (s) => s.quota !== null && habits.some((h) => h.id === s.habitId),
  );
  if (stats.length === 0) return null;
  const name = (s: HabitStats) => habits.find((h) => h.id === s.habitId)?.current.name ?? '';
  const ratio = (s: HabitStats) => `${String(s.met)}/${String(s.counted)}`;
  const sorted = [...stats].sort((a, b) => (b.quota ?? 0) - (a.quota ?? 0));
  const best = sorted[0];
  const weakest = sorted.length > 1 ? sorted[sorted.length - 1] : undefined;
  const overall = stats.reduce((sum, s) => sum + (s.quota ?? 0), 0) / stats.length;
  return (
    <section className="flex flex-col gap-1 rounded-card bg-surface-2 p-4">
      <span className="text-footnote font-semibold text-text-muted">Letzte Woche</span>
      <span className="text-title-2 font-bold tabular-nums">{percent(overall)}</span>
      <span className="text-subhead text-text-muted">
        {best ? `Am besten: ${name(best)} ${ratio(best)}` : ''}
        {weakest && weakest !== best ? ` · Ausbaufähig: ${name(weakest)} ${ratio(weakest)}` : ''}
      </span>
    </section>
  );
}

function HabitCard({
  habit,
  stats,
  days,
  onOpen,
}: {
  habit: Habit;
  stats: HabitStats | undefined;
  days: HabitDay[];
  onOpen: () => void;
}) {
  const weekly = habit.current.frequency === 'weekly';
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full flex-col gap-3 rounded-card bg-surface-2 p-4 text-left active:bg-surface-3"
    >
      <span className="flex items-baseline justify-between gap-3">
        <span className="truncate text-body font-semibold">{habit.current.name}</span>
        <span className="flex items-center gap-1 text-subhead font-semibold tabular-nums">
          {percent(stats?.quota ?? null)}
          <ChevronRightIcon aria-hidden className="text-text-subtle" />
        </span>
      </span>
      {!weekly && (
        <span className="flex gap-1" aria-hidden>
          {days.map((d) => (
            <span
              key={d.onDate}
              className={cn(
                'h-2 flex-1 rounded-pill',
                d.state === 'done'
                  ? 'bg-accent'
                  : d.state === 'partial'
                    ? 'bg-accent/45'
                    : d.state === 'paused'
                      ? 'border border-dashed border-text-subtle'
                      : d.state === null
                        ? 'bg-transparent'
                        : 'bg-surface-3',
              )}
            />
          ))}
        </span>
      )}
      <span className="text-footnote text-text-muted">
        {streakText(stats)}
        {stats && stats.bestStreak > stats.currentStreak
          ? ` · längste ${String(stats.bestStreak)}`
          : ''}{' '}
        · letzte 4 Wochen
      </span>
    </button>
  );
}

/** One habit's chart (by its input type) and figures, for 4 weeks or 3 months. */
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
  const stats = (useHabitStats(from, today).data ?? []).find((s) => s.habitId === habit?.id);
  const def = habit?.current;

  return (
    <Sheet
      open={habit !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
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
          <div className="grid grid-cols-3 gap-2">
            <Figure label="Quote" value={percent(stats?.quota ?? null)} />
            <Figure
              label={stats?.unit === 'weeks' ? 'Serie (Wochen)' : 'Serie (Tage)'}
              value={String(stats?.currentStreak ?? 0)}
            />
            <Figure label="Längste" value={String(stats?.bestStreak ?? 0)} />
          </div>
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
        </div>
      )}
    </Sheet>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-card bg-surface-2 px-3 py-2.5">
      <span className="text-caption text-text-muted">{label}</span>
      <span className="text-title-3 font-bold tabular-nums">{value}</span>
    </div>
  );
}
