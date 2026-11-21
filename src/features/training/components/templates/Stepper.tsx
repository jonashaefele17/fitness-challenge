/** − value + with an optional step and unit (e.g. 45 s in steps of 5). */
export function Stepper({
  label,
  value,
  min,
  max,
  step = 1,
  format = String,
  hideLabel = false,
  onChange,
}: {
  /** Also names the − and + buttons for screen readers. */
  label: string;
  /** The row already says what it is. */
  hideLabel?: boolean;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <span className="flex items-center gap-1 text-footnote text-text-muted">
      {!hideLabel && label}
      <button
        type="button"
        aria-label={`${label} weniger`}
        disabled={value <= min}
        onClick={() => {
          onChange(Math.max(min, value - step));
        }}
        className="flex size-tap items-center justify-center rounded-pill text-title-3 text-accent disabled:text-text-subtle"
      >
        −
      </button>
      <span className="min-w-5 text-center text-subhead font-semibold text-text tabular-nums">
        {format(value)}
      </span>
      <button
        type="button"
        aria-label={`${label} mehr`}
        disabled={value >= max}
        onClick={() => {
          onChange(Math.min(max, value + step));
        }}
        className="flex size-tap items-center justify-center rounded-pill text-title-3 text-accent disabled:text-text-subtle"
      >
        +
      </button>
    </span>
  );
}
