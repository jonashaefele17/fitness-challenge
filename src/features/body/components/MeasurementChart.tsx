import { useState, type PointerEvent } from 'react';
import { dotRadius, MIN_SPAN_CM, nearestIndex, timeChartLayout } from '../chart';
import { formatCm } from '../checkin';
import type { MeasurementPoint } from '../types';
import { useWidth } from './useWidth';

// SVG geometry in px (matches the h-chart token, as the weight chart).
const HEIGHT = 168;
const BOX = { left: 36, right: 8, top: 10, bottom: 22 };
// The small curve next to a row.
const SPARK = { width: 56, height: 20, left: 2, right: 2, top: 2, bottom: 2 };

const dayLabel = new Intl.DateTimeFormat('de', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
const shortDate = new Intl.DateTimeFormat('de', { day: 'numeric', month: 'short' });
const withYear = new Intl.DateTimeFormat('de', { day: 'numeric', month: 'short', year: '2-digit' });
const date = (day: string) => new Date(`${day}T12:00:00`);

const path = (xs: number[], ys: number[]) =>
  xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${String(x)},${String(ys[i] ?? 0)}`).join(' ');

/**
 * A measurement over time: each check-in as a dot on the accent line (one value: a single
 * dot in the middle). Min/max and the first/last date are labelled; tap or drag to read one.
 */
export function MeasurementChart({ points, unit }: { points: MeasurementPoint[]; unit: string }) {
  const [ref, width] = useWidth();
  const [picked, setPicked] = useState<number | null>(null);
  const layout =
    width > 0
      ? timeChartLayout(
          points.map((p) => p.onDate),
          points.map((p) => p.value),
          { width, height: HEIGHT, ...BOX },
          MIN_SPAN_CM,
        )
      : null;
  const pickedPoint = picked !== null ? points[picked] : undefined;
  const first = points[0];
  const last = points.at(-1);
  const sameYear = first && last && first.onDate.slice(0, 4) === last.onDate.slice(0, 4);
  const edgeDate = (day: string) => (sameYear ? shortDate : withYear).format(date(day));

  function pick(event: PointerEvent<SVGSVGElement>) {
    if (!layout) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const index = nearestIndex(layout.xs, event.clientX - rect.left);
    if (index >= 0) setPicked(index);
  }

  const r = dotRadius(points.length);
  return (
    <div className="flex flex-col gap-2">
      <p className="min-h-5 text-footnote text-text-muted tabular-nums" aria-live="polite">
        {pickedPoint
          ? `${dayLabel.format(date(pickedPoint.onDate))} · ${formatCm(pickedPoint.value)} ${unit}`
          : points.length > 1
            ? 'Antippen für Werte'
            : 'Die Kurve entsteht ab dem zweiten Zwischenstand'}
      </p>
      <div ref={ref} className="h-chart w-full">
        {layout && (
          <svg
            role="img"
            aria-label="Verlauf"
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
              y={layout.y(layout.max)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-text-subtle text-caption"
            >
              {formatCm(layout.max)}
            </text>
            {formatCm(layout.min) !== formatCm(layout.max) && (
              <text
                x={BOX.left - 6}
                y={layout.y(layout.min)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-text-subtle text-caption"
              >
                {formatCm(layout.min)}
              </text>
            )}
            {first && (
              <text
                x={layout.xs[0]}
                y={HEIGHT - 4}
                textAnchor={points.length === 1 ? 'middle' : 'start'}
                className="fill-text-subtle text-caption"
              >
                {edgeDate(first.onDate)}
              </text>
            )}
            {last && points.length > 1 && (
              <text
                x={layout.xs.at(-1)}
                y={HEIGHT - 4}
                textAnchor="end"
                className="fill-text-subtle text-caption"
              >
                {edgeDate(last.onDate)}
              </text>
            )}
            {pickedPoint && picked !== null && (
              <line
                x1={layout.xs[picked]}
                x2={layout.xs[picked]}
                y1={BOX.top}
                y2={HEIGHT - BOX.bottom}
                className="stroke-border"
                strokeWidth={1}
              />
            )}
            {points.length > 1 && (
              <path
                d={path(
                  layout.xs,
                  points.map((p) => layout.y(p.value)),
                )}
                fill="none"
                className="stroke-accent"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {points.map((p, i) => (
              <circle
                key={p.checkinId}
                cx={layout.xs[i]}
                cy={layout.y(p.value)}
                r={i === picked ? r + 1.5 : r}
                className={i === picked ? 'fill-text stroke-surface-2' : 'fill-accent'}
                strokeWidth={i === picked ? 2 : 0}
              />
            ))}
          </svg>
        )}
      </div>
    </div>
  );
}

/** The small curve of a row (from two values on; nothing before). */
export function MeasurementSparkline({ points }: { points: MeasurementPoint[] }) {
  if (points.length < 2) return null;
  const layout = timeChartLayout(
    points.map((p) => p.onDate),
    points.map((p) => p.value),
    SPARK,
    MIN_SPAN_CM,
  );
  if (!layout) return null;
  return (
    <svg
      width={SPARK.width}
      height={SPARK.height}
      aria-hidden
      className="shrink-0 overflow-visible"
    >
      <path
        d={path(
          layout.xs,
          points.map((p) => layout.y(p.value)),
        )}
        fill="none"
        className="stroke-accent"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
