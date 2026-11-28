import { useState, type PointerEvent } from 'react';
import { useWidth } from '@/shared/lib';
import {
  lineChartLayout,
  nearestIndex,
  valueOn,
  type LineAxis,
  type LinePoint,
} from './chartLayout';

export interface LineSeries<P extends LinePoint = LinePoint> {
  key: string;
  /** Shown in the readout. */
  name: string;
  /** CSS colour of the line (a person colour variable). */
  color: string;
  /** Oldest first. One point: a dot. */
  points: readonly P[];
  /** Pale single values under the line (e.g. a day's weight around its trend); optional. */
  dots?: readonly LinePoint[];
}

export interface LineChartProps<P extends LinePoint> {
  series: readonly LineSeries<P>[];
  axis: LineAxis;
  /** Accessible name of the chart. */
  label: string;
  /** A line's value in the readout. */
  formatValue: (point: P) => string;
  /** Axis labels (highest and lowest value). */
  formatAxis: (value: number) => string;
  /** Label of the dashed zero line. */
  zeroLabel: string;
  /**
   * A pale dashed straight line over the days shown (e.g. where one should be by then),
   * from its value on the first to its value on the last day; in the readout too.
   */
  reference?: { name: string; valueOn: (day: string) => number };
  /** The key of a line to stand out: the others are dimmed and left out of the readout. */
  highlight?: string | null;
}

// SVG geometry in px (matches the h-chart token).
const HEIGHT = 168;
const BOX = { left: 44, right: 8, top: 10, bottom: 22 };
const DOT_R = 2.5;
const DOT_OPACITY = 0.35;
/** Lines that do not stand out while one is highlighted. */
const DIM_OPACITY = 0.2;
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
 * Several lines on one axis (a line per person in their colour) with a quiet zero line;
 * tap or drag to read a day; optionally a reference line and one line highlighted. Remount
 * (key) to forget the picked day.
 */
export function LineChart<P extends LinePoint>({
  series,
  axis,
  label,
  formatValue,
  formatAxis,
  zeroLabel,
  reference,
  highlight = null,
}: LineChartProps<P>) {
  const [ref, width] = useWidth();
  const [picked, setPicked] = useState<number | null>(null);
  const days = series.flatMap((s) => s.points.map((p) => p.onDate)).sort();
  const edges = [days[0], days.at(-1)].filter((d) => d !== undefined);
  const layout =
    width > 0
      ? lineChartLayout(series, { width, height: HEIGHT, ...BOX }, axis, [
          ...series.flatMap((s) => (s.dots ?? []).map((d) => d.value)),
          ...(reference ? edges.map((d) => reference.valueOn(d)) : []),
        ])
      : null;
  const shown = highlight !== null && series.some((s) => s.key === highlight) ? highlight : null;
  const dimmed = (key: string) => shown !== null && key !== shown;
  // The highlighted line is drawn last, on top.
  const drawn = shown
    ? [...series.filter((s) => s.key !== shown), ...series.filter((s) => s.key === shown)]
    : series;
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
    ? series.flatMap((line) => {
        if (dimmed(line.key)) return [];
        const point = valueOn(line.points, pickedDay);
        return point ? [{ line, point }] : [];
      })
    : [];
  const zeroY = layout?.y(0) ?? 0;
  const edgeLabels = layout
    ? [layout.max, layout.min].filter(
        (value) =>
          formatAxis(value) !== formatAxis(0) && Math.abs(layout.y(value) - zeroY) >= LABEL_GAP,
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
            {readout.map(({ line, point }) => (
              <span key={line.key} className="flex items-center gap-1">
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-pill"
                  style={{ backgroundColor: line.color }}
                />
                <span>
                  {line.name} {formatValue(point)}
                </span>
              </span>
            ))}
            {reference && (
              <span>
                {reference.name} {formatAxis(reference.valueOn(pickedDay))}
              </span>
            )}
          </>
        ) : (
          <span>Antippen für Werte</span>
        )}
      </div>
      <div ref={ref} className="h-chart w-full">
        {layout && (
          <svg
            role="img"
            aria-label={label}
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
              {zeroLabel}
            </text>
            {edgeLabels.map((value) => (
              <text
                key={value}
                x={BOX.left - 6}
                y={layout.y(value)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-text-subtle text-caption"
              >
                {formatAxis(value)}
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

            {reference && first && last && layout.dates.length > 1 && (
              <line
                x1={layout.x(first)}
                x2={layout.x(last)}
                y1={layout.y(reference.valueOn(first))}
                y2={layout.y(reference.valueOn(last))}
                className="stroke-text-subtle"
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
            )}

            {/* Single values: pale dots under the lines. */}
            {drawn.flatMap((line) =>
              (line.dots ?? []).map((d) => (
                <circle
                  key={`${line.key}-${d.onDate}`}
                  cx={layout.x(d.onDate)}
                  cy={layout.y(d.value)}
                  r={DOT_R}
                  opacity={DOT_OPACITY * (dimmed(line.key) ? DIM_OPACITY : 1)}
                  style={{ fill: line.color }}
                />
              )),
            )}
            {drawn.map((line) =>
              line.points.length > 1 ? (
                <path
                  key={line.key}
                  d={line.points
                    .map(
                      (p, i) =>
                        `${i === 0 ? 'M' : 'L'}${String(layout.x(p.onDate))},${String(layout.y(p.value))}`,
                    )
                    .join(' ')}
                  fill="none"
                  opacity={dimmed(line.key) ? DIM_OPACITY : 1}
                  className="transition-opacity duration-(--duration-base) motion-reduce:transition-none"
                  style={{ stroke: line.color }}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : (
                // One point: a dot in the line's colour.
                line.points.map((p) => (
                  <circle
                    key={line.key}
                    cx={layout.x(p.onDate)}
                    cy={layout.y(p.value)}
                    r={4}
                    opacity={dimmed(line.key) ? DIM_OPACITY : 1}
                    style={{ fill: line.color }}
                  />
                ))
              ),
            )}
            {readout.map(({ line, point }) => (
              <circle
                key={line.key}
                cx={layout.x(point.onDate)}
                cy={layout.y(point.value)}
                r={4}
                className="stroke-surface-2"
                strokeWidth={2}
                style={{ fill: line.color }}
              />
            ))}
          </svg>
        )}
      </div>
    </div>
  );
}
