import { personColorKeys, personColorVar, type PersonColorKey } from '@/shared/design-tokens';
import { cn } from '@/shared/lib';

export interface ColorPickerProps {
  value: PersonColorKey;
  /** Colours other people in my groups already have. */
  taken: PersonColorKey[];
  onChange: (color: PersonColorKey) => void;
}

/** The eight person colours; ones a group mate has are shown but cannot be picked. */
export function ColorPicker({ value, taken, onChange }: ColorPickerProps) {
  return (
    <div role="radiogroup" aria-label="Deine Farbe" className="grid grid-cols-4 gap-3">
      {personColorKeys.map((color, index) => {
        const selected = color === value;
        const isTaken = !selected && taken.includes(color);
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`Farbe ${String(index + 1)}${isTaken ? ' (schon vergeben)' : ''}`}
            disabled={isTaken}
            onClick={() => {
              onChange(color);
            }}
            className={cn(
              'flex size-12 items-center justify-center justify-self-center rounded-pill border-2 p-1',
              selected ? 'border-text' : 'border-transparent',
              isTaken && 'opacity-25',
            )}
          >
            <span
              aria-hidden
              className="size-9 rounded-pill"
              style={{ backgroundColor: personColorVar(color) }}
            />
          </button>
        );
      })}
    </div>
  );
}
