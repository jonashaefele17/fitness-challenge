import { useState } from 'react';
import { SegmentedControl, Switch } from '@/shared/ui';
import { useExerciseRecords, useExerciseSessions } from '../../api/useHistory';
import { formatKg, formatSet } from '../../format';
import type { Device, ExerciseSession, ExerciseSummary } from '../../types';
import { HistoryChart, type ChartSeries } from './HistoryChart';

type Range = '3m' | '1y' | 'all';
const RANGE_DAYS: Record<Range, number | null> = { '3m': 92, '1y': 366, all: null };
const DAY_MS = 24 * 60 * 60 * 1000;

const longDate = new Intl.DateTimeFormat('de', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const shortDate = new Intl.DateTimeFormat('de', {
  day: 'numeric',
  month: 'short',
  year: '2-digit',
});
const compact = new Intl.NumberFormat('de', { notation: 'compact', maximumFractionDigits: 1 });

/**
 * My history of one exercise: strength (best set per workout) and volume over time,
 * records and every workout with its sets. Machines show their own history by default.
 */
export function ExerciseHistory({
  exercise,
  device,
}: {
  exercise: ExerciseSummary;
  device: Device | null;
}) {
  const machine = device !== null && !device.comparable;
  const [allDevices, setAllDevices] = useState(device === null);
  const [range, setRange] = useState<Range>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const scope = { exerciseId: exercise.id, deviceId: device?.id ?? null, allDevices };
  const sessions = useExerciseSessions(scope);
  const records = useExerciseRecords(scope).data;
  const measure = exercise.measure;

  const days = RANGE_DAYS[range];
  const inRange = (sessions.data ?? []).filter(
    (s) => days === null || now - new Date(s.startedAt).getTime() <= days * DAY_MS,
  );
  const chronological = [...inRange].reverse();
  const selected = inRange.find((s) => s.workoutId === selectedId) ?? inRange[0];

  const strength: ChartSeries[] = [
    {
      id: 'me',
      colorClass: 'text-accent',
      points: chronological.flatMap((s) =>
        s.score === null
          ? []
          : [{ id: s.workoutId, t: new Date(s.startedAt).getTime(), v: s.score }],
      ),
    },
  ];
  const volume: ChartSeries[] = [
    {
      id: 'me',
      colorClass: 'text-accent',
      points: chronological.flatMap((s) =>
        s.volumeKg === null
          ? []
          : [{ id: s.workoutId, t: new Date(s.startedAt).getTime(), v: s.volumeKg }],
      ),
    },
  ];
  const byId = new Map(inRange.map((s) => [s.workoutId, s]));
  const bestText = (id: string) => {
    const best = byId.get(id)?.best;
    return best ? formatSet(measure, best) : '';
  };

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        label="Zeitraum"
        value={range}
        onChange={setRange}
        options={[
          { value: '3m', label: '3 Monate' },
          { value: '1y', label: '1 Jahr' },
          { value: 'all', label: 'Alles' },
        ]}
      />
      {machine && (
        <Switch
          label="Alle Geräte"
          description="Auch Trainings an anderen Geräten zeigen."
          checked={allDevices}
          onCheckedChange={setAllDevices}
        />
      )}

      {!sessions.isPending && inRange.length === 0 && (
        <p className="text-subhead text-text-muted">
          {(sessions.data ?? []).length === 0
            ? 'Noch keine abgeschlossenen Trainings mit dieser Übung.'
            : 'In diesem Zeitraum keine Trainings.'}
        </p>
      )}

      {selected && (
        <div
          className="flex flex-col gap-0.5 rounded-card bg-surface-2 px-4 py-3"
          aria-live="polite"
        >
          <span className="text-footnote text-text-muted">
            {longDate.format(new Date(selected.startedAt))}
            {placeText(selected) && ` · ${placeText(selected)}`}
          </span>
          <span className="text-title-3 font-semibold">
            {selected.best ? formatSet(measure, selected.best) : '–'}
          </span>
          {selected.volumeKg !== null && (
            <span className="text-footnote text-text-muted">
              Volumen {formatKg(selected.volumeKg)} kg
            </span>
          )}
        </div>
      )}

      {strength[0] && strength[0].points.length > 0 && (
        <section className="flex flex-col gap-1">
          <h3 className="text-subhead font-semibold">Kraft</h3>
          <p className="text-footnote text-text-muted">
            {measure === 'weight_reps'
              ? 'Bester Satz pro Training – mehr Gewicht oder mehr Wiederholungen zählen beide.'
              : measure === 'reps'
                ? 'Meiste Wiederholungen pro Training.'
                : 'Längste Zeit pro Training.'}
          </p>
          <HistoryChart
            kind="line"
            series={strength}
            selectedId={selected?.workoutId ?? null}
            onSelect={setSelectedId}
            endLabels={bestText}
            label={`Kraftverlauf ${exercise.name}`}
          />
        </section>
      )}

      {measure === 'weight_reps' && volume[0] && volume[0].points.length > 0 && (
        <section className="flex flex-col gap-1">
          <h3 className="text-subhead font-semibold">Volumen</h3>
          <p className="text-footnote text-text-muted">
            kg × Wiederholungen aller Arbeitssätze pro Training.
          </p>
          <HistoryChart
            kind="bar"
            series={volume}
            selectedId={selected?.workoutId ?? null}
            onSelect={setSelectedId}
            formatTick={(value) => compact.format(value)}
            label={`Volumen ${exercise.name}`}
          />
        </section>
      )}

      {records?.best && (
        <section className="flex flex-col gap-2">
          <h3 className="text-subhead font-semibold">Rekorde</h3>
          <dl className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
            <RecordRow
              label="Bester Satz"
              value={formatSet(measure, records.best)}
              date={records.best.achievedAt}
            />
            {records.heaviest && (
              <RecordRow
                label="Schwerster Satz"
                value={formatSet(measure, records.heaviest)}
                date={records.heaviest.achievedAt}
              />
            )}
            {records.volume && (
              <RecordRow
                label="Meistes Volumen"
                value={`${formatKg(records.volume.volumeKg)} kg`}
                date={records.volume.achievedAt}
              />
            )}
          </dl>
          {records.repsAtWeight.length > 1 && (
            <>
              <span className="pt-1 text-footnote text-text-muted">
                Meiste Wiederholungen pro Gewicht
              </span>
              <div className="flex flex-wrap gap-2">
                {records.repsAtWeight.map((record) => (
                  <span
                    key={record.weightKg}
                    className="rounded-pill bg-surface-2 px-3 py-1.5 text-footnote"
                  >
                    {formatKg(record.weightKg)} kg ·{' '}
                    <span className="font-semibold">{record.reps} Wdh.</span>
                  </span>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {inRange.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-subhead font-semibold">Trainings</h3>
          <ul className="-mx-gutter flex flex-col">
            {inRange.map((session) => (
              <li key={session.workoutId}>
                <button
                  type="button"
                  aria-pressed={session.workoutId === selected?.workoutId}
                  onClick={() => {
                    setSelectedId(session.workoutId);
                  }}
                  className="flex min-h-tap w-full flex-col gap-0.5 px-gutter py-2.5 text-left active:bg-surface-2 aria-pressed:bg-surface-2"
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-subhead font-semibold">
                      {shortDate.format(new Date(session.startedAt))}
                    </span>
                    <span className="truncate text-footnote text-text-muted">
                      {placeText(session)}
                    </span>
                  </span>
                  <span className="text-footnote text-text-muted">
                    {session.sets
                      .map((set) => `${set.isWarmup ? 'W ' : ''}${formatSet(measure, set)}`)
                      .join(' · ')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function placeText(session: ExerciseSession): string {
  return [session.locationName, session.deviceName].filter(Boolean).join(' · ');
}

function RecordRow({ label, value, date }: { label: string; value: string; date: string }) {
  return (
    <div className="flex min-h-tap items-center justify-between gap-3 px-4 py-2">
      <dt className="text-subhead text-text-muted">{label}</dt>
      <dd className="flex flex-col items-end">
        <span className="text-subhead font-semibold">{value}</span>
        <span className="text-caption text-text-subtle">{shortDate.format(new Date(date))}</span>
      </dd>
    </div>
  );
}
