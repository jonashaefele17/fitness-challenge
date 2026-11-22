import { cn } from '@/shared/lib';
import { Button, CheckIcon, TextField } from '@/shared/ui';
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
          autoFocus
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
      const minutes = value && 'minutes' in value ? value.minutes : null;
      const h = minutes === null ? '' : String(Math.floor(minutes / 60));
      const m = minutes === null ? '' : String(minutes % 60);
      const set = (hours: number, mins: number) => {
        onChange({ minutes: Math.max(0, hours * 60 + mins) });
      };
      return (
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Stunden"
            type="number"
            inputMode="numeric"
            autoFocus
            className="h-tap text-title-2"
            value={h}
            onChange={(event) => {
              set(Number(event.target.value) || 0, minutes === null ? 0 : minutes % 60);
            }}
          />
          <TextField
            label="Minuten"
            type="number"
            inputMode="numeric"
            className="h-tap text-title-2"
            value={m}
            onChange={(event) => {
              set(minutes === null ? 0 : Math.floor(minutes / 60), Number(event.target.value) || 0);
            }}
          />
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
