import { cn } from '@/shared/lib';
import type { ReactNode } from 'react';
import { Button, CheckIcon, NumberWheel, TextField } from '@/shared/ui';
import type { HabitDefinition, HabitValue } from '../types';

const option =
  'flex min-h-tap w-full items-center justify-between gap-3 rounded-card border px-4 py-3 text-left text-body font-semibold';
const on = 'border-accent bg-accent text-on-accent';
const off = 'border-border bg-surface-2 active:bg-surface-3';

/**
 * The answer to one habit, by input type. Yes/no and choices answer with one tap
 * (`onAnswer`); the others are filled in and confirmed by the caller.
 */
export function HabitInput({
  def,
  value,
  onChange,
  onAnswer,
}: {
  def: HabitDefinition;
  value: HabitValue | null;
  onChange: (value: HabitValue) => void;
  /** One-tap answers (yes/no, choice): the answer is complete. */
  onAnswer: (value: HabitValue) => void;
}) {
  switch (def.inputType) {
    case 'yes_no': {
      const done = value && 'done' in value ? value.done : null;
      return (
        <div className="grid grid-cols-2 gap-3">
          <Button
            size="lg"
            variant={done === true ? 'primary' : 'secondary'}
            onClick={() => {
              onAnswer({ done: true });
            }}
          >
            Ja
          </Button>
          <Button
            size="lg"
            variant={done === false ? 'primary' : 'secondary'}
            onClick={() => {
              onAnswer({ done: false });
            }}
          >
            Nein
          </Button>
        </div>
      );
    }
    case 'choice': {
      const chosen = value && 'choice' in value ? value.choice : null;
      return (
        <div className="flex flex-col gap-2">
          {def.options.map((o) => (
            <button
              key={o.key}
              type="button"
              aria-pressed={chosen === o.key}
              onClick={() => {
                onAnswer({ choice: o.key });
              }}
              className={cn(option, chosen === o.key ? on : off)}
            >
              {o.label}
            </button>
          ))}
        </div>
      );
    }
    case 'checklist': {
      const checked = value && 'checked' in value ? value.checked : [];
      return (
        <div className="flex flex-col gap-2">
          {def.options.map((o) => {
            const ticked = checked.includes(o.key);
            return (
              <button
                key={o.key}
                type="button"
                aria-pressed={ticked}
                onClick={() => {
                  onChange({
                    checked: ticked ? checked.filter((k) => k !== o.key) : [...checked, o.key],
                  });
                }}
                className={cn(option, ticked ? on : off)}
              >
                {o.label}
                {ticked && <CheckIcon aria-hidden className="size-5" />}
              </button>
            );
          })}
        </div>
      );
    }
    case 'number': {
      const number = value && 'value' in value ? value.value : null;
      return (
        <TextField
          label={def.unit ?? 'Wert'}
          type="number"
          inputMode="decimal"
          className="h-tap text-title-2"
          value={number ?? ''}
          onChange={(event) => {
            const parsed = Number(event.target.value.replace(',', '.'));
            if (event.target.value !== '' && Number.isFinite(parsed)) onChange({ value: parsed });
          }}
        />
      );
    }
    case 'duration': {
      // Two wheels, no keyboard: hours and minutes in steps of five.
      const minutes = value && 'minutes' in value ? value.minutes : null;
      const h = minutes === null ? null : Math.floor(minutes / 60);
      const m = minutes === null ? null : minutes % 60;
      const set = (hours: number, mins: number) => {
        const total = Math.max(0, hours * 60 + mins);
        onChange({ minutes: total });
      };
      return (
        <div className="grid grid-cols-2 gap-3">
          <WheelField label="Stunden">
            <NumberWheel
              value={h}
              suggested={h === null}
              step={1}
              label="Stunden"
              format={(n) => String(n)}
              parse={(text) => Math.max(0, Math.round(Number(text) || 0))}
              onChange={(hours) => {
                set(hours, m ?? 0);
              }}
            />
          </WheelField>
          <WheelField label="Minuten">
            <NumberWheel
              value={m}
              suggested={m === null}
              step={5}
              label="Minuten"
              format={(n) => String(n).padStart(2, '0')}
              parse={(text) => Math.max(0, Math.round(Number(text) || 0))}
              onChange={(mins) => {
                set(h ?? 0, mins);
              }}
            />
          </WheelField>
        </div>
      );
    }
    case 'time_pair': {
      const pair = value && 'start' in value ? value : { start: '23:00', end: '07:00' };
      return (
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Ins Bett"
            type="time"
            className="h-tap appearance-none text-title-3"
            value={pair.start}
            onChange={(event) => {
              onChange({ start: event.target.value, end: pair.end });
            }}
          />
          <TextField
            label="Aufgestanden"
            type="time"
            className="h-tap appearance-none text-title-3"
            value={pair.end}
            onChange={(event) => {
              onChange({ start: pair.start, end: event.target.value });
            }}
          />
        </div>
      );
    }
  }
}

function WheelField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-card bg-surface-2 py-2">
      <span className="text-footnote text-text-muted">{label}</span>
      {children}
    </div>
  );
}
