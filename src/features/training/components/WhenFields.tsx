import { TextField } from '@/shared/ui';
import type { When } from './when';

// iOS draws date and time fields flatter than text fields: same height, no native frame.
const nativeField = 'h-tap appearance-none';

/** Day, start time and duration of a workout (added afterwards or moved). */
export function WhenFields({
  value,
  onChange,
  showDate = true,
}: {
  value: When;
  onChange: (value: When) => void;
  /** Off when the day is already chosen (e.g. from the calendar). */
  showDate?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {showDate && (
        <div className="col-span-2">
          <TextField
            label="Tag"
            type="date"
            className={nativeField}
            value={value.date}
            onChange={(event) => {
              onChange({ ...value, date: event.target.value });
            }}
          />
        </div>
      )}
      <TextField
        label="Start"
        type="time"
        className={nativeField}
        value={value.time}
        onChange={(event) => {
          onChange({ ...value, time: event.target.value });
        }}
      />
      <TextField
        label="Dauer (Min.)"
        inputMode="numeric"
        value={value.minutes}
        onChange={(event) => {
          onChange({ ...value, minutes: event.target.value });
        }}
      />
    </div>
  );
}
