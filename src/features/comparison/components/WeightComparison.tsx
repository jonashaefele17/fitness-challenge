import { formatKg, formatPercentChange } from '@/features/body';
import { Avatar } from '@/features/profile';
import { Button, LineChart, type LinePoint, type LineSeries } from '@/shared/ui';
import { useGroupWeight } from '../api/useGroupWeight';

interface WeightPoint extends LinePoint {
  trendKg: number | null;
}

/**
 * Vergleich → Gewicht: the change in % of everyone who shares their weight from `from` to
 * `to`, a line each in their colour (all starting at 0 %), and a row per person below. Who
 * does not share is not there; if I do not share, a hint leads to the setting.
 */
export function WeightComparison({
  from,
  to,
  onOpenSharing,
}: {
  from: string;
  to: string;
  onOpenSharing: () => void;
}) {
  const { people, myShare, isPending } = useGroupWeight(from, to);
  const iShare = myShare !== null && myShare !== 'private';

  if (!isPending && people.length === 0) {
    return (
      <section className="flex flex-col items-center gap-3 rounded-card bg-surface-2 px-6 py-8 text-center">
        <div className="flex flex-col gap-1">
          <h2 className="text-body font-semibold">Noch keine Gewichte zum Vergleichen</h2>
          <p className="text-subhead text-text-muted">
            {iShare
              ? 'In diesem Zeitraum hat niemand ein geteiltes Gewicht eingetragen.'
              : 'Hier erscheint, wer sein Gewicht mit der Gruppe teilt – nur die Veränderung in % oder auch in kg.'}
          </p>
        </div>
        {!iShare && (
          <Button variant="tinted" onClick={onOpenSharing}>
            Sichtbarkeit einstellen
          </Button>
        )}
      </section>
    );
  }

  const series: LineSeries<WeightPoint>[] = people.map((person) => ({
    key: person.id,
    name: person.name,
    color: person.color,
    points: person.days.map((d) => ({
      onDate: d.onDate,
      value: d.changePct,
      trendKg: d.trendKg,
    })),
    dots: person.dayPcts.map((d) => ({ onDate: d.onDate, value: d.pct })),
  }));

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-card bg-surface-2 p-4">
        {isPending ? (
          <div className="h-chart" aria-hidden />
        ) : (
          <LineChart
            key={`${from}/${to}`}
            series={series}
            axis="percent"
            label="Gewichtsveränderung in Prozent"
            formatValue={(point) =>
              `${formatPercentChange(point.value)}${point.trendKg !== null ? ` · ${formatKg(point.trendKg)} kg` : ''}`
            }
            formatAxis={formatPercentChange}
            zeroLabel="0 %"
          />
        )}
      </section>
      <ul className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
        {people.map((person) => (
          <li key={person.id} className="flex min-h-tap items-center gap-3 px-4 py-2">
            <Avatar profile={person.member} size="sm" />
            <span className="min-w-0 flex-1 truncate text-subhead font-semibold">
              {person.name}
            </span>
            <span className="flex flex-col items-end tabular-nums">
              <span className="text-subhead font-semibold">
                {formatPercentChange(person.changePct)}
              </span>
              {person.trendKg !== null && (
                <span className="text-footnote text-text-muted">
                  Ø {formatKg(person.trendKg)} kg
                </span>
              )}
            </span>
          </li>
        ))}
        {!isPending && !iShare && (
          <li className="flex min-h-tap items-center gap-3 py-1 pr-1 pl-4">
            <span className="min-w-0 flex-1 text-subhead text-text-muted">
              Du teilst dein Gewicht nicht
            </span>
            <Button variant="ghost" onClick={onOpenSharing}>
              Sichtbarkeit
            </Button>
          </li>
        )}
      </ul>
      <p className="px-1 text-footnote text-text-muted">
        Veränderung des 7-Tage-Durchschnitts seit dem ersten Eintrag im Zeitraum
        {people.some((p) => p.dayPcts.length > 0) && ' · Punkte: einzelne Tage'}
      </p>
    </div>
  );
}
