import { useState } from 'react';
import { cn, showToast } from '@/shared/lib';
import { Button, CheckIcon, ChevronLeftIcon, CloseIcon, Sheet } from '@/shared/ui';
import { useHabitDays, useHabitWeeks, useMyHabits, useSetHabitEntry } from '../api/useHabits';
import { todayKey } from '../dates';
import { ruleText, startValue, valueText } from '../habitText';
import type { Habit, HabitDay, HabitValue, HabitWeek } from '../types';
import { HabitInput } from './HabitInput';

interface Item {
  habit: Habit;
  day: HabitDay;
  week: HabitWeek | undefined;
}

/** Today's habits in check-in order: morning first, then the order of my list. */
function useToday(today: string): Item[] {
  const habits = (useMyHabits().data ?? []).filter((h) => !h.archived);
  const days = useHabitDays(today, today).data ?? [];
  const weeks = useHabitWeeks(today, today).data ?? [];
  return habits
    .flatMap((habit) => {
      const day = days.find((d) => d.habitId === habit.id);
      if (!day || day.paused || (!day.due && day.frequency !== 'weekly')) return [];
      return [{ habit, day, week: weeks.find((w) => w.habitId === habit.id) }];
    })
    .sort((a, b) => Number(a.day.timeOfDay === 'evening') - Number(b.day.timeOfDay === 'evening'));
}

/** Not answered yet today (weekly: nothing today and the week's target not reached). */
function isOpen(item: Item): boolean {
  return item.day.frequency === 'weekly'
    ? item.day.value === null && item.week?.state !== 'done'
    : item.day.state === 'open';
}

/** Done today (weekly: done today or the week's target reached). */
function isDone(item: Item): boolean {
  return item.day.state === 'done' || item.week?.state === 'done';
}

/**
 * Heute: one tile per habit due today with its state; the check-in asks one question per
 * screen (under 20 seconds). Habits fed from trainings only show their state.
 */
export function CheckIn() {
  const [today] = useState(todayKey);
  const items = useToday(today);
  const [start, setStart] = useState<number | null>(null);
  const askable = items.filter((i) => i.day.source !== 'training');
  if (items.length === 0) return null;
  const open = askable.filter(isOpen);

  const done = items.filter(isDone).length;

  return (
    <section className="flex flex-col gap-3 rounded-card bg-surface-2 py-4">
      <div className="flex items-baseline justify-between px-4">
        <h2 className="text-body font-semibold">Check-in</h2>
        <span className="text-footnote text-text-muted">
          {done} von {items.length}
        </span>
      </div>
      <ul className="no-scrollbar flex gap-2 overflow-x-auto px-4">
        {items.map((item) => (
          <li key={item.habit.id} className="shrink-0">
            <Tile
              item={item}
              onOpen={() => {
                if (item.day.source === 'training') {
                  showToast('Zählt deine Trainings – nichts einzutragen.');
                  return;
                }
                setStart(askable.indexOf(item));
              }}
            />
          </li>
        ))}
      </ul>
      {askable.length > 0 && (
        <div className="px-4">
          <Button
            className="w-full"
            variant={open.length > 0 ? 'tinted' : 'ghost'}
            onClick={() => {
              setStart(open[0] ? askable.indexOf(open[0]) : 0);
            }}
          >
            {open.length > 0 ? 'Check-in starten' : 'Erledigt ✓ · Ändern'}
          </Button>
        </div>
      )}
      <CheckInFlow
        items={askable}
        start={start}
        today={today}
        onClose={() => {
          setStart(null);
        }}
      />
    </section>
  );
}

function Tile({ item, onOpen }: { item: Item; onOpen: () => void }) {
  const done = isDone(item);
  const partial = !done && item.day.state === 'partial';
  const missed = !done && item.day.state === 'missed';
  const weekly = item.day.frequency === 'weekly';
  const detail = weekly
    ? `${String(item.week?.doneDays ?? 0)}/${String(item.week?.target ?? item.habit.current.timesPerWeek ?? 0)} Woche`
    : (valueText(item.habit.current, item.day.value) ?? 'offen');
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'flex h-24 w-28 flex-col justify-between rounded-card border p-3 text-left active:bg-surface-3',
        done ? 'border-accent bg-accent/15' : 'border-border bg-surface-3',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-6 items-center justify-center rounded-pill border-2',
          done && 'border-accent bg-accent text-on-accent',
          partial && 'border-accent',
          missed && 'border-border text-text-subtle',
          !done && !partial && !missed && 'border-border',
        )}
      >
        {missed && <CloseIcon className="size-3.5" />}
        {done && <CheckIcon className="size-4" />}
        {partial && <span className="size-2.5 rounded-pill bg-accent" />}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-subhead font-semibold">{item.habit.current.name}</span>
        <span className="truncate text-caption text-text-muted">{detail}</span>
      </span>
    </button>
  );
}

/** One question per screen; one-tap answers move on by themselves. */
function CheckInFlow({
  items,
  start,
  today,
  onClose,
}: {
  items: Item[];
  start: number | null;
  today: string;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<HabitValue | null>(null);
  const [opened, setOpened] = useState<number | null>(null);
  const setEntry = useSetHabitEntry();
  // A fresh start each time it opens (state adjusted while rendering).
  if (start !== opened) {
    setOpened(start);
    if (start !== null) {
      setIndex(start);
      const item = items[start];
      setDraft(item ? (item.day.value ?? startValue(item.habit.current)) : null);
    }
  }
  const item = start === null ? undefined : items[index];
  const finished = start !== null && index >= items.length;

  function go(next: number) {
    setIndex(next);
    const nextItem = items[next];
    setDraft(nextItem ? (nextItem.day.value ?? startValue(nextItem.habit.current)) : null);
  }

  function save(value: HabitValue | null) {
    if (item && value) {
      setEntry.mutate({ habitId: item.habit.id, onDate: today, value });
    }
    go(index + 1);
  }

  return (
    <Sheet
      open={start !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Check-in"
      // One height for every question: the sheet does not jump between them.
      className="min-h-sheet-min"
    >
      {item && (
        <div className="flex min-h-sheet-min flex-col gap-6 pt-1">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              {index > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    go(index - 1);
                  }}
                  className="-ml-2 flex min-h-tap items-center gap-1 rounded-pill px-2 text-subhead font-semibold text-accent active:bg-surface-2"
                >
                  <ChevronLeftIcon aria-hidden /> Zurück
                </button>
              ) : (
                <span />
              )}
              <span className="text-footnote text-text-muted">
                {index + 1} von {items.length}
              </span>
            </div>
            <h3 className="text-title-2 font-bold">{item.habit.current.name}</h3>
            <span className="text-subhead text-text-muted">
              {item.day.frequency === 'weekly'
                ? `Heute gemacht? · ${String(item.week?.doneDays ?? 0)}/${String(item.week?.target ?? 0)} diese Woche`
                : ruleText(item.habit.current)}
            </span>
          </div>
          <HabitInput
            key={item.habit.id}
            def={item.habit.current}
            value={draft}
            onChange={setDraft}
            onAnswer={(value) => {
              setDraft(value);
              save(value);
            }}
          />
          <div className="mt-auto flex flex-col gap-2 pb-2">
            {item.habit.current.inputType !== 'yes_no' &&
              item.habit.current.inputType !== 'choice' && (
                <Button
                  size="lg"
                  missing={draft ? null : 'Trag erst einen Wert ein.'}
                  onClick={() => {
                    save(draft);
                  }}
                >
                  {index + 1 < items.length ? 'Weiter' : 'Fertig'}
                </Button>
              )}
            <Button
              variant="ghost"
              onClick={() => {
                go(index + 1);
              }}
            >
              Überspringen
            </Button>
          </div>
        </div>
      )}
      {finished && (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <span className="flex size-16 items-center justify-center rounded-pill bg-accent text-title-1 text-on-accent">
            <CheckIcon className="size-8" />
          </span>
          <p className="text-title-3 font-semibold">Check-in erledigt</p>
          <Button size="lg" className="w-full" onClick={onClose}>
            Schließen
          </Button>
        </div>
      )}
    </Sheet>
  );
}
