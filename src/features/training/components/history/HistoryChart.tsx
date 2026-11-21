import { useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import { cn } from '@/shared/lib';

export interface ChartPoint {
  id: string;
  /** Time in ms. */
  t: number;
  v: number;
}

export interface ChartSeries {
  id: string;
  /** Text colour class; marks draw in currentColor (e.g. "text-accent"). */
  colorClass: string;
  points: ChartPoint[];
}

// SVG geometry in px (the chart measures its own width).
const HEIGHT = 168;
const PAD_TOP = 18;
const PAD_BOTTOM = 22;
const PAD_RIGHT = 14;
const PAD_LEFT_TICKS = 44;
const PAD_LEFT_PLAIN = 14;
const BAR_MAX = 24;
const BAR_MIN = 4;
const BAR_RADIUS = 4;
const DOT_R = 4;
const DOT_R_SELECTED = 6;
const DAY_MS = 24 * 60 * 60 * 1000;

const dayMonth = new Intl.DateTimeFormat('de', { day: 'numeric', month: 'short' });
const monthYear = new Intl.DateTimeFormat('de', { month: 'short', year: '2-digit' });

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

/** 0 / 500 / 1.000 style ticks from zero. */
function niceTicks(max: number): number[] {
  if (max <= 0) return [0];
  const rough = max / 3;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * magnitude).find((s) => s >= rough) ?? rough;
  const ticks: number[] = [];
  for (let value = 0; value <= max + step * 0.001; value += step) ticks.push(value);
  if ((ticks.at(-1) ?? 0) < max) ticks.push((ticks.at(-1) ?? 0) + step);
  return ticks;
}

/**
 * Time-based line or bar chart for one exercise. Single tap picks the nearest workout
 * (mobile: no hover); the selection is shown by the caller. Line charts do not start at
 * zero (progress), bar charts do (amounts).
 */
export function HistoryChart({
  kind,
  series,
  selectedId,
  onSelect,
  formatTick,
  endLabels,
  label,
}: {
  kind: 'line' | 'bar';
  series: ChartSeries[];
  selectedId: string | null;
  onSelect: (pointId: string) => void;
  /** Y-axis labels (bar charts); omitted for lines, whose ends are labelled instead. */
  formatTick?: ((value: number) => string) | undefined;
  /** Text at the first and last point of the first series (lines). */
  endLabels?: ((pointId: string) => string) | undefined;
  /** Accessible description. */
  label: string;
}) {
  const [ref, width] = useWidth();
  const all = series.flatMap((s) => s.points);
  const main = series[0]?.points ?? [];

  if (all.length === 0 || width === 0) {
    return <div ref={ref} className="h-chart w-full" />;
  }

  const padLeft = formatTick ? PAD_LEFT_TICKS : PAD_LEFT_PLAIN;
  const plotW = Math.max(1, width - padLeft - PAD_RIGHT);
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;

  let tMin = Math.min(...all.map((p) => p.t));
  let tMax = Math.max(...all.map((p) => p.t));
  if (tMax - tMin < DAY_MS) {
    tMin -= DAY_MS;
    tMax += DAY_MS;
  }
  const values = all.map((p) => p.v);
  let vMin: number;
  let vMax: number;
  const ticks = kind === 'bar' ? niceTicks(Math.max(...values)) : [];
  if (kind === 'bar') {
    vMin = 0;
    vMax = ticks.at(-1) ?? 1;
  } else {
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const pad = (hi - lo) * 0.15 || Math.max(1, hi * 0.05);
    vMin = lo - pad;
    vMax = hi + pad;
  }

  const barW = Math.min(BAR_MAX, Math.max(BAR_MIN, (plotW / Math.max(1, main.length)) * 0.6));
  // Bars sit fully inside the plot, so the outer ones never cover the axis labels.
  const inset = kind === 'bar' ? barW / 2 + 2 : 0;
  const x = (t: number) => padLeft + inset + ((t - tMin) / (tMax - tMin)) * (plotW - 2 * inset);
  const y = (v: number) => PAD_TOP + (1 - (v - vMin) / (vMax - vMin || 1)) * plotH;
  const baseline = PAD_TOP + plotH;

  const spanDays = (tMax - tMin) / DAY_MS;
  const dateFormat = spanDays > 180 ? monthYear : dayMonth;
  const xTicks = [tMin, (tMin + tMax) / 2, tMax];
  const gridValues = kind === 'bar' ? ticks : [vMin + (vMax - vMin) / 2];

  function pick(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - rect.left;
    let nearest: ChartPoint | undefined;
    for (const point of main) {
      if (!nearest || Math.abs(x(point.t) - px) < Math.abs(x(nearest.t) - px)) nearest = point;
    }
    if (nearest) onSelect(nearest.id);
  }

  const selected = main.find((p) => p.id === selectedId);
  const first = main[0];
  const last = main.at(-1);

  return (
    <div ref={ref} className="w-full">
      <svg
        role="img"
        aria-label={label}
        width={width}
        height={HEIGHT}
        className="block touch-pan-y select-none"
        onPointerDown={pick}
      >
        {gridValues.map((value) => (
          <g key={value}>
            <line
              x1={padLeft}
              x2={width - PAD_RIGHT}
              y1={y(value)}
              y2={y(value)}
              className="stroke-border"
              strokeWidth={1}
            />
            {formatTick && (
              <text
                x={padLeft - 6}
                y={y(value)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-text-subtle text-caption"
              >
                {formatTick(value)}
              </text>
            )}
          </g>
        ))}
        {xTicks.map((t, index) => (
          <text
            key={t}
            x={x(t)}
            y={HEIGHT - 4}
            textAnchor={index === 0 ? 'start' : index === 2 ? 'end' : 'middle'}
            className="fill-text-subtle text-caption"
          >
            {dateFormat.format(new Date(t))}
          </text>
        ))}

        {selected && (
          <line
            x1={x(selected.t)}
            x2={x(selected.t)}
            y1={PAD_TOP - 6}
            y2={baseline}
            className="stroke-text-subtle"
            strokeWidth={1}
          />
        )}

        {series.map((s, seriesIndex) => (
          <g key={s.id} className={s.colorClass}>
            {kind === 'line' ? (
              <>
                <polyline
                  points={s.points.map((p) => `${String(x(p.t))},${String(y(p.v))}`).join(' ')}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {s.points.map((p) => {
                  const isSelected = seriesIndex === 0 && p.id === selectedId;
                  return (
                    <circle
                      key={p.id}
                      cx={x(p.t)}
                      cy={y(p.v)}
                      r={isSelected ? DOT_R_SELECTED : DOT_R}
                      fill="currentColor"
                      className="stroke-surface"
                      strokeWidth={2}
                    />
                  );
                })}
              </>
            ) : (
              s.points.map((p) => {
                const top = y(p.v);
                const h = Math.max(0, baseline - top);
                const r = Math.min(BAR_RADIUS, h, barW / 2);
                const left = x(p.t) - barW / 2;
                return (
                  <path
                    key={p.id}
                    d={`M${String(left)},${String(baseline)} V${String(top + r)} Q${String(left)},${String(top)} ${String(left + r)},${String(top)} H${String(left + barW - r)} Q${String(left + barW)},${String(top)} ${String(left + barW)},${String(top + r)} V${String(baseline)} Z`}
                    fill="currentColor"
                    className={cn(selectedId !== null && p.id !== selectedId && 'opacity-50')}
                  />
                );
              })
            )}
          </g>
        ))}

        {kind === 'line' && endLabels && first && last && (
          <>
            <text
              x={x(first.t)}
              y={y(first.v) - 10}
              textAnchor="start"
              className="fill-text-muted text-caption"
            >
              {endLabels(first.id)}
            </text>
            {last.id !== first.id && (
              <text
                x={x(last.t)}
                y={y(last.v) - 10}
                textAnchor="end"
                className="fill-text text-caption font-semibold"
              >
                {endLabels(last.id)}
              </text>
            )}
          </>
        )}
      </svg>
    </div>
  );
}
