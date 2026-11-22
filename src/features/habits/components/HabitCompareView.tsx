import { useQueries } from '@tanstack/react-query';
import { useState, type CSSProperties } from 'react';
import { useUserId } from '@/features/auth';
import { cn } from '@/shared/lib';
import { CompareTable, SegmentedControl, Sheet, type CompareRow } from '@/shared/ui';
import { habitDaysOptions, habitSummaryOptions, habitWeeksOptions } from '../api/useHabits';
import { percent } from '../cells';
import type { HabitPerson } from '../compare';
import { addDays, todayKey } from '../dates';
import { figures } from '../figures';
import { nightAxis, nightClock } from '../nights';
import { HabitLines, HabitNights } from './HabitCharts';
import type { HabitDay, HabitWeek } from '../types';

export type CompareRange = '4w' | '3m';

/** A day in someone's colour: met full, partly faded, missed grey, due today outlined. */
function personCell(state: HabitDay['state'] | HabitWeek['state'] | undefined, color: string) {
  const style: CSSProperties = {};
  let className = 'bg-transparent';
  switch (state) {
    case 'done':
      style.backgroundColor = color;
      className = '';
      break;
    case 'partial':
      style.backgroundColor = `color-mix(in srgb, ${color} 45%, transparent)`;
      className = '';
      break;
    case 'missed':
      className = 'bg-surface-3';
      break;
    case 'open':
      className = 'border border-border';
      break;
    case 'paused':
      className = 'border border-dashed border-text-subtle';
      break;
  }
  return { className, style };
}

/**
 * The same habit of several people: figures side by side (a column per person), then each
 * one's course in their colour. Everyone is measured by their own goals; values only show
 * where they are shared.
 */
export function HabitCompareView({
  people,
  range,
  today,
}: {
  people: HabitPerson[];
  range: CompareRange;
  today: string;
}) {
  const userId = useUserId();
  const from = addDays(today, range === '4w' ? -27 : -90);
  const summaries = useQueries({
    queries: people.map((p) => habitSummaryOptions(userId, from, today, p.habit.userId)),
  });
  const days = useQueries({
    queries: people.map((p) => habitDaysOptions(userId, from, today, p.habit.userId)),
  });
  const weeks = useQueries({
    queries: people.map((p) => habitWeeksOptions(userId, from, today, p.habit.userId)),
  });
  const of = <T extends { habitId: string }>(list: T[] | undefined, person: HabitPerson) =>
    (list ?? []).filter((x) => x.habitId === person.habit.id);

  const perPerson = people.map((person, i) => {
    const summary = of(summaries[i]?.data, person)[0];
    const personWeeks = of(weeks[i]?.data, person);
    return {
      summary,
      days: of(days[i]?.data, person),
      weeks: personWeeks,
      figures: figures(person.habit.current, summary, personWeeks).filter(
        (f) => f.label !== 'Quote' && f.label !== 'Trend' && f.label !== 'Punkte',
      ),
    };
  });
  const labels = perPerson[0]?.figures.map((f) => f.label) ?? [];
  const rows: CompareRow[] = [
    {
      key: 'quota',
      label: 'Quote',
      cells: perPerson.map((p) => ({
        value: percent(p.summary?.quota ?? null),
        fraction: p.summary?.quota ?? null,
      })),
    },
    ...labels.map((label) => ({
      key: label,
      label,
      cells: perPerson.map((p) => {
        const figure = p.figures.find((f) => f.label === label);
        return figure && figure.value !== '–' ? { value: figure.value } : null;
      }),
    })),
  ];

  const weekly = people[0]?.habit.current.frequency === 'weekly';
  const dates = Array.from({ length: 28 }, (_, i) => addDays(today, i - 27));
  const def = people[0]?.habit.current;
  // Values only from me and those who share them; the others only say whether it was met.
  const withValues = people
    .map((person, i) => ({ person, days: perPerson[i]?.days ?? [] }))
    .filter(({ person }) => person.habit.userId === userId || person.habit.shareLevel === 'values');
  const onlyDone = people.filter((p) => !withValues.some((v) => v.person.id === p.id));
  const kind =
    !def || weekly
      ? null
      : def.inputType === 'number' || def.inputType === 'duration'
        ? 'lines'
        : def.inputType === 'time_pair'
          ? 'nights'
          : def.inputType === 'checklist'
            ? 'items'
            : null;
  const allDates = Array.from({ length: range === '4w' ? 28 : 91 }, (_, i) =>
    addDays(today, i - (range === '4w' ? 27 : 90)),
  );
  const axis = def
    ? nightAxis(
        withValues.map((v) => v.days),
        def,
      )
    : { lo: 0, hi: 0 };
  // Checklist: every item anyone has, how often it was ticked (of the answered days).
  const items = [
    ...new Map(
      withValues.flatMap(({ person }) =>
        person.habit.current.options.map((o) => [o.key, o.label] as const),
      ),
    ),
  ];
  const itemRows: CompareRow[] = items.map(([key, label]) => ({
    key,
    label,
    cells: people.map((person) => {
      const entry = withValues.find((v) => v.person.id === person.id);
      if (!entry || !person.habit.current.options.some((o) => o.key === key)) return null;
      const answered = entry.days.filter((d) => d.due && !d.paused && d.state !== 'open');
      if (answered.length === 0) return null;
      const share =
        answered.filter((d) => d.value && 'checked' in d.value && d.value.checked.includes(key))
          .length / answered.length;
      return { value: percent(share), fraction: share };
    }),
  }));

  return (
    <div className="flex flex-col gap-5">
      <CompareTable
        columns={people.map((p) => ({ key: p.id, label: p.name, color: p.color }))}
        rows={rows}
      />
      {kind && def && withValues.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-footnote font-semibold text-text-muted">
            {kind === 'items' ? 'Pro Punkt' : 'Verlauf'}
          </h3>
          {kind === 'items' ? (
            <CompareTable
              columns={people.map((p) => ({ key: p.id, label: p.name, color: p.color }))}
              rows={itemRows}
            />
          ) : (
            <div className="flex flex-col gap-3 rounded-card bg-surface-2 p-4">
              {kind === 'lines' ? (
                <HabitLines
                  def={def}
                  dates={allDates}
                  series={withValues.map(({ person, days: personDays }) => {
                    const condition = person.habit.current.rule[0];
                    return {
                      id: person.id,
                      name: person.name,
                      color: person.color,
                      days: personDays,
                      target: condition ? Number(condition.value) : null,
                    };
                  })}
                />
              ) : (
                <>
                  {withValues.map(({ person, days: personDays }) => (
                    <div key={person.id} className="flex flex-col gap-1">
                      <span className="text-footnote font-semibold">{person.name}</span>
                      <HabitNights
                        days={personDays}
                        def={person.habit.current}
                        color={person.color}
                        axis={axis}
                        compact
                      />
                    </div>
                  ))}
                  <div className="flex justify-between text-caption text-text-muted tabular-nums">
                    <span>Balken von oben {nightClock(axis.lo)}</span>
                    <span>bis unten {nightClock(axis.hi)}</span>
                  </div>
                </>
              )}
            </div>
          )}
          {onlyDone.length > 0 && (
            <p className="px-1 text-footnote text-text-muted">
              {onlyDone.map((p) => p.name).join(', ')} {onlyDone.length === 1 ? 'teilt' : 'teilen'}{' '}
              nur, ob erledigt.
            </p>
          )}
        </section>
      )}
      <section className="flex flex-col gap-2">
        <h3 className="text-footnote font-semibold text-text-muted">
          {weekly
            ? 'Wochen'
            : range === '4w'
              ? 'Erfüllt · letzte 28 Tage'
              : 'Erfüllt pro Woche (Anteil der Tage)'}
        </h3>
        <div className="flex flex-col gap-2.5 rounded-card bg-surface-2 p-4">
          {people.map((person, i) => {
            const p = perPerson[i];
            if (!p) return null;
            return (
              <div key={person.id} className="flex items-center gap-3">
                <span className="w-16 shrink-0 truncate text-footnote font-semibold">
                  {person.name}
                </span>
                {weekly ? (
                  <span className="flex flex-1 gap-1">
                    {p.weeks.map((w) => {
                      const cell = personCell(w.state, person.color);
                      return (
                        <span
                          key={w.weekStart}
                          className={cn('rounded-xs h-4 flex-1', cell.className)}
                          style={cell.style}
                        />
                      );
                    })}
                  </span>
                ) : range === '4w' ? (
                  <span className="grid flex-1 grid-cols-28 gap-0.5">
                    {dates.map((date) => {
                      const cell = personCell(
                        p.days.find((d) => d.onDate === date)?.state,
                        person.color,
                      );
                      return (
                        <span
                          key={date}
                          className={cn('rounded-xs aspect-square', cell.className)}
                          style={cell.style}
                        />
                      );
                    })}
                  </span>
                ) : (
                  <WeekShares days={p.days} color={person.color} />
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/** 3 months of a daily habit: a bar per week, as high as the share of days met. */
function WeekShares({ days, color }: { days: HabitDay[]; color: string }) {
  const byWeek = new Map<string, { met: number; counted: number }>();
  days.forEach((d) => {
    const weekday = (new Date(`${d.onDate}T12:00:00`).getDay() + 6) % 7;
    const key = addDays(d.onDate, -weekday);
    const week = byWeek.get(key) ?? { met: 0, counted: 0 };
    if (d.state === 'done' || d.state === 'partial' || d.state === 'missed') week.counted += 1;
    if (d.state === 'done') week.met += 1;
    byWeek.set(key, week);
  });
  const weeks = [...byWeek.entries()].sort(([a], [b]) => a.localeCompare(b));
  return (
    <span className="flex h-6 flex-1 items-end gap-1">
      {weeks.map(([key, w]) => (
        <span key={key} className="rounded-xs flex h-full flex-1 items-end bg-surface-3">
          <span
            className="rounded-xs block w-full"
            style={{
              height: `${String(w.counted === 0 ? 0 : Math.round((w.met / w.counted) * 100))}%`,
              backgroundColor: color,
            }}
          />
        </span>
      ))}
    </span>
  );
}

/** The comparison on its own (from the group's overview): title, range, people. */
export function HabitCompareSheet({
  title,
  people,
  onClose,
}: {
  title: string;
  people: HabitPerson[] | null;
  onClose: () => void;
}) {
  const [today] = useState(todayKey);
  const [range, setRange] = useState<CompareRange>('4w');
  return (
    <Sheet
      open={people !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={title}
    >
      {people && (
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
          <HabitCompareView people={people} range={range} today={today} />
        </div>
      )}
    </Sheet>
  );
}
