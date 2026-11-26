import { useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import { dotRadius, nearestIndex, weightChartLayout } from '../chart';
import { formatKg } from '../format';
import type { WeightDay } from '../types';

// SVG geometry in px (matches the h-chart token; the chart measures its own width).
const HEIGHT = 168;
const BOX = { left: 36, right: 8, top: 10, bottom: 22 };

const dayLabel = new Intl.DateTimeFormat('de', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
const shortDate = new Intl.DateTimeFormat('de', { day: 'numeric', month: 'short' });
const withYear = new Intl.DateTimeFormat('de', { day: 'numeric', month: 'short', year: '2-digit' });
const date = (day: string) => new Date(`${day}T12:00:00`);

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

/**
 * Weight over the period: each day's value as a quiet dot, the 7-day trend as the accent
 * line. Only min/max and the first/last date are labelled; tap or drag to read a day.
 */
export function WeightChart({ days }: { days: WeightDay[] }) {
  const [ref, width] = useWidth();
  const [picked, setPicked] = useState<number | null>(null);
  const layout = width > 0 ? weightChartLayout(days, { width, height: HEIGHT, ...BOX }) : null;
  const pickedDay = picked !== null ? days[picked] : undefined;
  const first = days[0];
  const last = days.at(-1);
  const sameYear = first && last && first.onDate.slice(0, 4) === last.onDate.slice(0, 4);
  const edgeDate = (day: string) => (sameYear ? shortDate : withYear).format(date(day));

  function pick(event: PointerEvent<SVGSVGElement>) {
    if (!layout) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const index = nearestIndex(layout.xs, event.clientX - rect.left);
    if (index >= 0) setPicked(index);
  }

  const r = dotRadius(days.length);
  const trend = layout
    ? days
        .map(
          (d, i) => `${i === 0 ? 'M' : 'L'}${String(layout.xs[i])},${String(layout.y(d.trendKg))}`,
        )
        .join(' ')
    : '';

  return (
    <div className="flex flex-col gap-2">
      <p className="min-h-5 text-footnote text-text-muted tabular-nums" aria-live="polite">
        {pickedDay
          ? `${dayLabel.format(date(pickedDay.onDate))} · ${formatKg(pickedDay.weightKg)} kg${
              pickedDay.entries > 1 ? ` (${String(pickedDay.entries)} Einträge)` : ''
            } · Ø 7 Tage ${formatKg(pickedDay.trendKg)}`
          : 'Antippen für Werte'}
      </p>
      <div ref={ref} className="h-chart w-full">
        {layout && (
          <svg
            role="img"
            aria-label="Gewichtsverlauf"
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
            <text
              x={BOX.left - 6}
              y={layout.y(layout.maxKg)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-text-subtle text-caption"
            >
              {formatKg(layout.maxKg)}
            </text>
            {formatKg(layout.minKg) !== formatKg(layout.maxKg) && (
              <text
                x={BOX.left - 6}
                y={layout.y(layout.minKg)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-text-subtle text-caption"
              >
                {formatKg(layout.minKg)}
              </text>
            )}
            {first && (
              <text
                x={layout.xs[0]}
                y={HEIGHT - 4}
                textAnchor={days.length === 1 ? 'middle' : 'start'}
                className="fill-text-subtle text-caption"
              >
                {edgeDate(first.onDate)}
              </text>
            )}
            {last && days.length > 1 && (
              <text
                x={layout.xs.at(-1)}
                y={HEIGHT - 4}
                textAnchor="end"
                className="fill-text-subtle text-caption"
              >
                {edgeDate(last.onDate)}
              </text>
            )}

            {pickedDay && picked !== null && (
              <line
                x1={layout.xs[picked]}
                x2={layout.xs[picked]}
                y1={BOX.top}
                y2={HEIGHT - BOX.bottom}
                className="stroke-border"
                strokeWidth={1}
              />
            )}

            {days.map((d, i) => (
              <circle
                key={d.onDate}
                cx={layout.xs[i]}
                cy={layout.y(d.weightKg)}
                r={i === picked ? r + 1.5 : r}
                className={i === picked ? 'fill-text' : 'fill-text-subtle'}
              />
            ))}
            {days.length > 1 && (
              <path
                d={trend}
                fill="none"
                className="stroke-accent"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {days.length === 1 && first && (
              // One day: its trend is the value itself; show it in the line's colour.
              <circle
                cx={layout.xs[0]}
                cy={layout.y(first.trendKg)}
                r={4}
                className="fill-accent"
              />
            )}
            {pickedDay && picked !== null && (
              <circle
                cx={layout.xs[picked]}
                cy={layout.y(pickedDay.trendKg)}
                r={4}
                className="fill-accent stroke-surface-2"
                strokeWidth={2}
              />
            )}
          </svg>
        )}
      </div>
    </div>
  );
}
