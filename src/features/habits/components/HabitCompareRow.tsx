import { useState } from 'react';
import { cn } from '@/shared/lib';
import { useHabitDays, useHabitSummary } from '../api/useHabits';
import { cellClass, percent } from '../cells';
import { addDays, formatMinutes, todayKey } from '../dates';
import type { Habit } from '../types';

/**
 * One person in the group's comparison of a habit: the last 7 days with "5/7",
 * the share of the last 4 weeks, and (shared with values) the average.
 */
export function HabitCompareRow({
  habit,
  label,
  color,
}: {
  habit: Habit;
  label: string;
  /** CSS colour of the person. */
  color: string;
}) {
  const [today] = useState(todayKey);
  const first = addDays(today, -6);
  const days = (useHabitDays(first, today, habit.userId).data ?? []).filter(
    (d) => d.habitId === habit.id,
  );
  const summary = (useHabitSummary(addDays(today, -27), today, habit.userId).data ?? []).find(
    (s) => s.habitId === habit.id,
  );
  const dates = Array.from({ length: 7 }, (_, i) => addDays(first, i));
  const counted = days.filter(
    (d) => d.state === 'done' || d.state === 'partial' || d.state === 'missed',
  );
  const met = days.filter((d) => d.state === 'done').length;
  const def = habit.current;
  const average =
    summary?.avgDuration != null
      ? formatMinutes(summary.avgDuration)
      : summary?.avgValue != null
        ? def.inputType === 'duration'
          ? formatMinutes(Math.round(summary.avgValue))
          : `${summary.avgValue.toLocaleString('de', { maximumFractionDigits: summary.avgValue >= 100 ? 0 : 1 })}${def.unit ? ` ${def.unit}` : ''}`
        : null;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3">
      <span className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-pill"
          style={{ backgroundColor: color }}
        />
        <span className="truncate text-subhead font-semibold">{label}</span>
      </span>
      <span className="grid grid-cols-7 gap-1" aria-hidden>
        {dates.map((date) => (
          <span
            key={date}
            className={cn('rounded-xs size-4', cellClass(days.find((d) => d.onDate === date)))}
          />
        ))}
      </span>
      <span className="w-14 text-right text-footnote tabular-nums">
        <span className="font-semibold">{percent(summary?.quota ?? null)}</span>
        {def.frequency !== 'weekly' && (
          <span className="block text-caption text-text-muted">
            {met}/{counted.length}
          </span>
        )}
      </span>
      {average && (
        <span className="col-span-3 pl-4.5 text-caption text-text-muted">Ø {average}</span>
      )}
    </div>
  );
}
