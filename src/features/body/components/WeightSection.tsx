import { useState } from 'react';
import { Button, ChevronRightIcon, SegmentedControl } from '@/shared/ui';
import { useWeightDays, useWeightSummary } from '../api/useWeight';
import { formatKg, formatPercentChange, formatSignedKg, periodRange, todayKey } from '../format';
import type { Scale, WeighIn, WeightPeriod } from '../types';
import { WeightChart } from './WeightChart';

const PERIODS: { value: WeightPeriod; label: string }[] = [
  { value: '4w', label: '4 Wochen' },
  { value: '3m', label: '3 Monate' },
  { value: '1y', label: '1 Jahr' },
  { value: 'all', label: 'Alles' },
];
const PERIOD_TEXT: Record<WeightPeriod, string> = {
  '4w': 'in 4 Wochen',
  '3m': 'in 3 Monaten',
  '1y': 'in einem Jahr',
  all: 'seit dem ersten Eintrag',
};
/** Entries shown at first, and added per "Mehr anzeigen". */
const PAGE = 10;

const entryDate = new Intl.DateTimeFormat('de', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
const entryDateWithYear = new Intl.DateTimeFormat('de', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const shortDate = new Intl.DateTimeFormat('de', { day: 'numeric', month: 'short' });
const date = (day: string) => new Date(`${day}T12:00:00`);

/**
 * Ich → Körper → weight: the current value (7-day trend), its change in the period, the
 * chart and the entries; or, before the first entry, a short invitation.
 */
export function WeightSection({
  entries,
  scales,
  today,
  onWeigh,
}: {
  entries: WeighIn[];
  scales: Scale[];
  today: string;
  /** Open the weigh-in: an entry to change, or null for a new one. */
  onWeigh: (entry: WeighIn | null) => void;
}) {
  const [period, setPeriod] = useState<WeightPeriod>('4w');

  if (entries.length === 0) {
    return (
      <section className="flex flex-col items-center gap-4 rounded-card bg-surface-2 px-6 py-8 text-center">
        <div className="flex flex-col gap-1">
          <h2 className="text-body font-semibold">Noch kein Gewicht eingetragen</h2>
          <p className="text-subhead text-text-muted">
            Wiege dich, wann es dir passt. Die Kurve glättet Schwankungen von Tag zu Tag.
          </p>
        </div>
        <Button
          size="lg"
          onClick={() => {
            onWeigh(null);
          }}
        >
          Gewicht eintragen
        </Button>
      </section>
    );
  }

  return (
    <>
      <WeightCard period={period} onPeriod={setPeriod} today={today} />
      <Button
        size="lg"
        fullWidth
        onClick={() => {
          onWeigh(null);
        }}
      >
        Gewicht eintragen
      </Button>
      <Entries entries={entries} scales={scales} onOpen={onWeigh} />
    </>
  );
}

function WeightCard({
  period,
  onPeriod,
  today,
}: {
  period: WeightPeriod;
  onPeriod: (period: WeightPeriod) => void;
  today: string;
}) {
  const range = periodRange(period, today);
  // The current value is the latest trend, whatever the period shows.
  const current = useWeightSummary(null, today).data;
  const summary = useWeightSummary(range.from, range.to).data;
  const days = useWeightDays(range.from, range.to).data ?? [];
  const hasChange = summary && summary.daysWithEntries >= 2 && summary.changeKg !== null;

  return (
    <section className="flex flex-col gap-4 rounded-card bg-surface-2 p-4">
      <div className="flex flex-col gap-1">
        <p className="flex items-baseline gap-1.5">
          <span className="text-large-title font-bold tabular-nums">
            {formatKg(current?.currentTrendKg ?? null)}
          </span>
          <span className="text-title-3 text-text-muted">kg</span>
        </p>
        <p className="text-footnote text-text-muted">
          Ø 7 Tage
          {current?.currentOn && current.currentOn !== today
            ? ` · Stand ${shortDate.format(date(current.currentOn))}`
            : ''}
        </p>
        <p className="text-subhead tabular-nums">
          {hasChange ? (
            <>
              <span className="font-semibold">
                {formatSignedKg(summary.changeKg)} kg · {formatPercentChange(summary.changePct)}
              </span>{' '}
              <span className="text-text-muted">{PERIOD_TEXT[period]}</span>
            </>
          ) : (
            <span className="text-text-muted">
              {summary?.daysWithEntries === 0
                ? `Keine Einträge ${PERIOD_TEXT[period]}`
                : 'Die Veränderung zeigt sich ab dem zweiten Tag'}
            </span>
          )}
        </p>
      </div>
      <SegmentedControl label="Zeitraum" value={period} onChange={onPeriod} options={PERIODS} />
      {days.length > 0 ? (
        <WeightChart key={period} days={days} />
      ) : (
        <div className="flex h-chart items-center justify-center text-footnote text-text-subtle">
          Keine Einträge in diesem Zeitraum
        </div>
      )}
    </section>
  );
}

function Entries({
  entries,
  scales,
  onOpen,
}: {
  entries: WeighIn[];
  scales: Scale[];
  onOpen: (entry: WeighIn) => void;
}) {
  const [shown, setShown] = useState(PAGE);
  const [thisYear] = useState(() => todayKey().slice(0, 4));
  // Scale names only for people with more than one scale.
  const named = scales.length > 1;
  const main = scales.find((s) => s.isMain && !s.archived);
  const scaleName = (entry: WeighIn) =>
    (entry.scaleId ? scales.find((s) => s.id === entry.scaleId) : main)?.name ?? null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-footnote font-semibold text-text-muted">Einträge</h2>
      <ul className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
        {entries.slice(0, shown).map((entry) => {
          const scale = named ? scaleName(entry) : null;
          return (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => {
                  onOpen(entry);
                }}
                className="flex min-h-tap w-full items-center gap-3 px-4 py-2 text-left active:bg-surface-3"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-subhead">
                    {(entry.measuredOn.slice(0, 4) === thisYear
                      ? entryDate
                      : entryDateWithYear
                    ).format(date(entry.measuredOn))}
                  </span>
                  {scale && <span className="truncate text-footnote text-text-muted">{scale}</span>}
                </span>
                <span className="text-body font-semibold tabular-nums">
                  {formatKg(entry.weightKg)} kg
                </span>
                <ChevronRightIcon aria-hidden className="shrink-0 text-text-subtle" />
              </button>
            </li>
          );
        })}
      </ul>
      {entries.length > shown && (
        <Button
          variant="ghost"
          onClick={() => {
            setShown((n) => n + PAGE);
          }}
        >
          Mehr anzeigen
        </Button>
      )}
    </section>
  );
}
