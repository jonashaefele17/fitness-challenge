import { Sheet } from '@/shared/ui';
import { useMeasurementHistory } from '../api/useCheckins';
import { formatCm } from '../checkin';
import type { MeasurementKind } from '../types';
import { MeasurementChart } from './MeasurementChart';

const entryDate = new Intl.DateTimeFormat('de', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const date = (day: string) => new Date(`${day}T12:00:00`);

/** One measurement: its curve, every value with its day, and how to measure it. */
export function MeasurementHistorySheet({
  kind,
  open,
  onOpenChange,
}: {
  /** Kept while the sheet closes, so its title does not change on the way out. */
  kind: MeasurementKind | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const history = useMeasurementHistory(open && kind ? kind.key : null);
  const points = history.data ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={kind?.label ?? ''}>
      {kind && history.isSuccess && (
        <div className="flex flex-col gap-4 pt-1">
          <section className="rounded-card bg-surface-2 p-4">
            <MeasurementChart key={kind.key} points={points} unit={kind.unit} />
          </section>
          <ul className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
            {[...points].reverse().map((point) => (
              <li
                key={point.checkinId}
                className="flex min-h-tap items-center justify-between gap-3 px-4 py-2"
              >
                <span className="text-subhead">{entryDate.format(date(point.onDate))}</span>
                <span className="text-body font-semibold tabular-nums">
                  {formatCm(point.value)} {kind.unit}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-footnote text-text-subtle">So misst du: {kind.hint}</p>
        </div>
      )}
    </Sheet>
  );
}
