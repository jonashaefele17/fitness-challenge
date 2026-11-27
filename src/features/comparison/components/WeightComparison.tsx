import { useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import { formatKg, formatPercentChange, nearestIndex, todayKey } from '@/features/body';
import { Avatar } from '@/features/profile';
import { Button, SegmentedControl } from '@/shared/ui';
import { useGroupWeight, type WeightComparePeriod, type WeightPerson } from '../api/useGroupWeight';
import { percentChartLayout, valueOn } from '../chart';

const PERIODS: { value: WeightComparePeriod; label: string }[] = [
  { value: '4w', label: '4 Wochen' },
  { value: '3m', label: '3 Monate' },
  { value: '1y', label: '1 Jahr' },
];

// SVG geometry in px (matches the h-chart token, like the body module's WeightChart).
const HEIGHT = 168;
/** Day values of people who share them: small and pale, the lines stay in front. */
const DAY_DOT_R = 2.5;
const DAY_DOT_OPACITY = 0.35;
const BOX = { left: 44, right: 8, top: 10, bottom: 22 };
/** Axis labels closer than this to the zero line's label are left out. */
const LABEL_GAP = 12;

const dayLabel = new Intl.DateTimeFormat('de', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
const shortDate = new Intl.DateTimeFormat('de', { day: 'numeric', month: 'short' });
const withYear = new Intl.DateTimeFormat('de', { day: 'numeric', month: 'short', year: '2-digit' });
const date = (day: string) => new Date(`${day}T12:00:00`);

/**
 * Gruppe → Gewicht: the change in % of everyone who shares their weight, a line each in
 * their colour (all starting at 0 %), and a row per person below. Who does not share is
 * not there; if I do not share, a hint leads to the setting.
 */
export function WeightComparison({ onOpenSharing }: { onOpenSharing: () => void }) {
  const [today] = useState(todayKey);
  const [period, setPeriod] = useState<WeightComparePeriod>('4w');
  const { people, myShare, isPending } = useGroupWeight(period, today);
  const iShare = myShare === 'percent' || myShare === 'kg';

  if (!isPending && people.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <SegmentedControl label="Zeitraum" value={period} onChange={setPeriod} options={PERIODS} />
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
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-4 rounded-card bg-surface-2 p-4">
        <SegmentedControl label="Zeitraum" value={period} onChange={setPeriod} options={PERIODS} />
        {isPending ? (
          <div className="h-chart" aria-hidden />
        ) : (
          <PercentChart key={period} people={people} />
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

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);
  return [ref, width] as const;
}

/** A % line per person on one axis with a quiet zero line; tap or drag to read a day. */
function PercentChart({ people }: { people: WeightPerson[] }) {
  const [ref, width] = useWidth();
  const [picked, setPicked] = useState<number | null>(null);
  const layout =
    width > 0
      ? percentChartLayout(
          people.map((p) => ({ key: p.id, days: p.days })),
          { width, height: HEIGHT, ...BOX },
          people.flatMap((p) => p.dayPcts.map((d) => d.pct)),
        )
      : null;
  const pickedDay = picked !== null ? layout?.dates[picked] : undefined;
  const first = layout?.dates[0];
  const last = layout?.dates.at(-1);
  const sameYear = first && last && first.slice(0, 4) === last.slice(0, 4);
  const edgeDate = (day: string) => (sameYear ? shortDate : withYear).format(date(day));

  function pick(event: PointerEvent<SVGSVGElement>) {
    if (!layout) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const index = nearestIndex(layout.xs, event.clientX - rect.left);
    if (index >= 0) setPicked(index);
  }

  const readout = pickedDay
    ? people.flatMap((person) => {
        const day = valueOn(person.days, pickedDay);
        return day ? [{ person, day }] : [];
      })
    : [];
  const zeroY = layout?.y(0) ?? 0;
  const edgeLabels = layout
    ? [layout.maxPct, layout.minPct].filter(
        (pct) =>
          formatPercentChange(pct) !== formatPercentChange(0) &&
          Math.abs(layout.y(pct) - zeroY) >= LABEL_GAP,
      )
    : [];

  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex min-h-5 flex-wrap items-center gap-x-3 gap-y-0.5 text-footnote text-text-muted tabular-nums"
        aria-live="polite"
      >
        {pickedDay ? (
          <>
            <span>{dayLabel.format(date(pickedDay))}</span>
            {readout.map(({ person, day }) => (
              <span key={person.id} className="flex items-center gap-1">
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-pill"
                  style={{ backgroundColor: person.color }}
                />
                <span>
                  {person.name} {formatPercentChange(day.changePct)}
                  {day.trendKg !== null ? ` · ${formatKg(day.trendKg)} kg` : ''}
                </span>
              </span>
            ))}
          </>
        ) : (
          <span>Antippen für Werte</span>
        )}
      </div>
      <div ref={ref} className="h-chart w-full">
        {layout && (
          <svg
            role="img"
            aria-label="Gewichtsveränderung in Prozent"
            width={width}
            height={HEIGHT}
            className="block touch-pan-y select-none"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              pick(event);
            }}
            onPointerMove={(event) => {
              if (event.buttons > 0 || event.pointerType === 'touch') pick(event);
            }}
          >
            <line
              x1={BOX.left}
              x2={width - BOX.right}
              y1={zeroY}
              y2={zeroY}
              className="stroke-border"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <text
              x={BOX.left - 6}
              y={zeroY}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-text-subtle text-caption"
            >
              0 %
            </text>
            {edgeLabels.map((pct) => (
              <text
                key={pct}
                x={BOX.left - 6}
                y={layout.y(pct)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-text-subtle text-caption"
              >
                {formatPercentChange(pct)}
              </text>
            ))}
            {first && (
              <text
                x={layout.x(first)}
                y={HEIGHT - 4}
                textAnchor={layout.dates.length === 1 ? 'middle' : 'start'}
                className="fill-text-subtle text-caption"
              >
                {edgeDate(first)}
              </text>
            )}
            {last && layout.dates.length > 1 && (
              <text
                x={layout.x(last)}
                y={HEIGHT - 4}
                textAnchor="end"
                className="fill-text-subtle text-caption"
              >
                {edgeDate(last)}
              </text>
            )}

            {pickedDay && (
              <line
                x1={layout.x(pickedDay)}
                x2={layout.x(pickedDay)}
                y1={BOX.top}
                y2={HEIGHT - BOX.bottom}
                className="stroke-border"
                strokeWidth={1}
              />
            )}

            {/* Day values of people who share them: pale dots under the lines. */}
            {people.flatMap((person) =>
              person.dayPcts.map((d) => (
                <circle
                  key={`${person.id}-${d.onDate}`}
                  cx={layout.x(d.onDate)}
                  cy={layout.y(d.pct)}
                  r={DAY_DOT_R}
                  opacity={DAY_DOT_OPACITY}
                  style={{ fill: person.color }}
                />
              )),
            )}
            {people.map((person) =>
              person.days.length > 1 ? (
                <path
                  key={person.id}
                  d={person.days
                    .map(
                      (d, i) =>
                        `${i === 0 ? 'M' : 'L'}${String(layout.x(d.onDate))},${String(layout.y(d.changePct))}`,
                    )
                    .join(' ')}
                  fill="none"
                  style={{ stroke: person.color }}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : (
                // One day: a dot at 0 % in the person's colour.
                person.days.map((d) => (
                  <circle
                    key={person.id}
                    cx={layout.x(d.onDate)}
                    cy={layout.y(d.changePct)}
                    r={4}
                    style={{ fill: person.color }}
                  />
                ))
              ),
            )}
            {readout.map(({ person, day }) => (
              <circle
                key={person.id}
                cx={layout.x(day.onDate)}
                cy={layout.y(day.changePct)}
                r={4}
                className="stroke-surface-2"
                strokeWidth={2}
                style={{ fill: person.color }}
              />
            ))}
          </svg>
        )}
      </div>
    </div>
  );
}
