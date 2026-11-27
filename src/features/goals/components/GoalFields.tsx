import { cn } from '@/shared/lib';
import { CheckIcon, ChevronRightIcon } from '@/shared/ui';
import type { GoalVisibility } from '../types';
import { formatGoalDay } from '../view';

const weekday = new Intl.DateTimeFormat('de', { weekday: 'short', timeZone: 'UTC' });

/** A row with a day; a tap opens the phone's date picker. */
export function DateRow({
  label,
  day,
  today,
  min,
  onChange,
}: {
  label: string;
  day: string;
  today: string;
  min?: string;
  onChange: (day: string) => void;
}) {
  return (
    <li>
      <label className="relative flex min-h-tap w-full items-center gap-3 px-4 py-2 active:bg-surface-3">
        <span className="text-body">{label}</span>
        <span className="min-w-0 flex-1 truncate text-right text-subhead text-text-muted tabular-nums">
          {day === today
            ? 'Heute'
            : `${weekday.format(new Date(`${day}T12:00:00Z`))}, ${formatGoalDay(day, today)}`}
        </span>
        <ChevronRightIcon aria-hidden className="shrink-0 text-text-subtle" />
        <input
          type="date"
          aria-label={label}
          value={day}
          min={min}
          onClick={(event) => {
            try {
              event.currentTarget.showPicker();
            } catch {
              // Older browsers open their picker on their own.
            }
          }}
          onChange={(event) => {
            const next = event.target.value;
            if (next) onChange(next);
          }}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
    </li>
  );
}

/** "Nur ich" / "Mit der Gruppe teilen" as two rows, with what sharing shows under the second. */
export function VisibilityChoice({
  value,
  note,
  onChange,
}: {
  value: GoalVisibility;
  note: string;
  onChange: (value: GoalVisibility) => void;
}) {
  const options: { value: GoalVisibility; label: string; detail: string }[] = [
    { value: 'private', label: 'Nur ich', detail: 'Niemand sonst sieht das Ziel.' },
    { value: 'shared', label: 'Mit der Gruppe teilen', detail: note },
  ];
  return (
    <ul
      role="radiogroup"
      aria-label="Sichtbarkeit"
      className="flex flex-col divide-y divide-border rounded-card bg-surface-2"
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <li key={o.value}>
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => {
                onChange(o.value);
              }}
              className="flex min-h-tap w-full items-start gap-3 px-4 py-3 text-left active:bg-surface-3"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-body">{o.label}</span>
                <span className="text-footnote text-text-muted">{o.detail}</span>
              </span>
              <span
                aria-hidden
                className={cn(
                  'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-pill border',
                  selected ? 'border-accent bg-accent text-on-accent' : 'border-text-subtle',
                )}
              >
                {selected && <CheckIcon className="size-4" strokeWidth={3} />}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
