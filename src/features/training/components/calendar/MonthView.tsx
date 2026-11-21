import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { cn } from '@/shared/lib';
import { ChevronLeftIcon, ChevronRightIcon } from '@/shared/ui';
import { useWorkoutsInRange } from '../../api/useCalendar';
import { addDays, addMonths, dayKey, monthWeeks, startOfMonth } from '../../calendar';
import { DayList } from './DayList';
import { DayMarks } from './DayMarks';
import { ACCENT, byDay, dayTitle, monthTitle, WEEKDAYS, type LogRow } from './logData';

/** Horizontal finger travel (px) that flips the month. */
const SWIPE_PX = 60;

function sameMonth(a: Date, b: Date): boolean {
  return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

/**
 * My month on one screen: seven full-width columns, fixed square-ish cells with the date,
 * the type icon and a quiet label. Tap a day to see it below; swipe or arrows for months.
 */
export function MonthView({
  today,
  headerEnd,
  onOpen,
}: {
  today: Date;
  /** Right end of the header row (the "Gruppe" switch). */
  headerEnd: ReactNode;
  onOpen: (workoutId: string) => void;
}) {
  const [month, setMonth] = useState(() => startOfMonth(today));
  const [selected, setSelected] = useState<string | null>(() => dayKey(today));
  const swipe = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const mondays = monthWeeks(month);
  const range = { from: mondays[0] ?? month, to: addDays(mondays.at(-1) ?? month, 7) };
  const workouts = useWorkoutsInRange(range).data ?? [];
  const days = byDay(workouts);
  const me: LogRow = { id: 'me', initial: '', name: 'Du', color: ACCENT, workouts };
  const todayKey = dayKey(today);

  function showMonth(next: Date) {
    setMonth(next);
    setSelected(sameMonth(next, today) ? todayKey : null);
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

  return (
    <div className="flex flex-col gap-3">
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
        {headerEnd}
      </div>

      <div
        className="flex touch-pan-y flex-col gap-1 rounded-card bg-surface-2 p-1.5"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onClickCapture={(event) => {
          // A swipe must not also tap the day it started on.
          if (swipe.current?.moved) {
            event.stopPropagation();
            swipe.current = null;
          }
        }}
      >
        <div aria-hidden className="grid grid-cols-7 text-center text-caption text-text-subtle">
          {WEEKDAYS.map((weekday) => (
            <span key={weekday} className="py-1">
              {weekday}
            </span>
          ))}
        </div>
        {mondays.map((monday) => (
          <div key={dayKey(monday)} className="grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }, (_, index) => addDays(monday, index)).map((day) => {
              const key = dayKey(day);
              const list = days.get(key) ?? [];
              const outside = !sameMonth(day, month);
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={key === selected}
                  aria-label={`${dayTitle.format(day)}${list.length ? `: ${String(list.length)} Training${list.length > 1 ? 's' : ''}` : ''}`}
                  onClick={() => {
                    setSelected(key);
                  }}
                  className={cn(
                    // Short screens (iPhone SE): flatter cells so the whole month fits above the navigation.
                    'flex h-14 min-w-0 flex-col items-center gap-0.5 rounded-sm pt-1 [@media(max-height:700px)]:h-11 [@media(max-height:700px)]:gap-0 [@media(max-height:700px)]:pt-0.5 [@media(max-height:700px)]:[&_svg]:size-4',
                    key === selected ? 'bg-surface-3' : 'active:bg-surface-3',
                    outside && 'opacity-40',
                  )}
                  style={{ color: ACCENT }}
                >
                  <span
                    className={cn(
                      'flex size-5 items-center justify-center rounded-pill text-caption tabular-nums [@media(max-height:700px)]:size-4',
                      key === todayKey
                        ? 'bg-accent font-semibold text-on-accent'
                        : day > today
                          ? 'text-text-subtle'
                          : 'text-text-muted',
                    )}
                  >
                    {day.getDate()}
                  </span>
                  <DayMarks workouts={list} />
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {selectedDate ? (
        <section className="flex flex-col gap-2">
          {/* Full tap height: the day's actions (plan, add a past workout) go on the right. */}
          <div className="flex min-h-tap items-center justify-between gap-2">
            <h3 className="text-footnote font-semibold text-text-muted">
              {dayTitle.format(selectedDate)}
            </h3>
          </div>
          <DayList
            entries={(days.get(selected ?? '') ?? []).map((workout) => ({ row: me, workout }))}
            showNames={false}
            onOpen={onOpen}
          />
        </section>
      ) : (
        <p className="text-footnote text-text-subtle">Tippe auf einen Tag, um ihn zu sehen.</p>
      )}
    </div>
  );
}
