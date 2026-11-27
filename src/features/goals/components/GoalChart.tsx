import { useState, type PointerEvent } from 'react';
import { cn, useWidth } from '@/shared/lib';
import { barChartScale, levelChartScale, nearestIndex, rateWeeks } from '../chart';
import { formatGoalNumber, formatGoalValue, goalPointStateText } from '../format';
import { targetLine } from '../goal';
import type { Goal, GoalHistoryPoint, GoalPointState } from '../types';
import { formatGoalDay } from '../view';

// SVG geometry in px (HEIGHT matches the h-chart token; the chart measures its own width).
const HEIGHT = 168;
const BOX = { left: 40, right: 8, top: 10, bottom: 22 };

function pickHandlers(xs: readonly number[], onPick: (index: number) => void) {
  const pick = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const index = nearestIndex(xs, event.clientX - rect.left);
    if (index >= 0) onPick(index);
  };
  return {
    onPointerDown: (event: PointerEvent<SVGSVGElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      pick(event);
    },
    onPointerMove: (event: PointerEvent<SVGSVGElement>) => {
      if (event.buttons > 0 || event.pointerType === 'touch') pick(event);
    },
  };
}

/** The course of a goal: levels against the line from start to target, rates per week. */
export function GoalChart({
  goal,
  points,
  today,
}: {
  goal: Goal;
  points: GoalHistoryPoint[];
  today: string;
}) {
  return goal.metricKind === 'level' ? (
    <LevelChart goal={goal} points={points} today={today} />
  ) : (
    <RateChart goal={goal} points={points} today={today} />
  );
}

/**
 * Levels: the whole period wide; the straight line from start to target dashed, the
 * minimum as a quiet dotted line, the values as the accent line (with dots when there are
 * few). Tap or drag to read a day.
 */
function LevelChart({
  goal,
  points,
  today,
}: {
  goal: Goal;
  points: GoalHistoryPoint[];
  today: string;
}) {
  const [ref, width] = useWidth();
  const [picked, setPicked] = useState<number | null>(null);
  const shown = points.filter((p): p is GoalHistoryPoint & { value: number } => p.value !== null);
  const scale = width > 0 ? levelChartScale(goal, shown, { width, height: HEIGHT, ...BOX }) : null;
  const line = targetLine(goal);
  const xs = scale ? shown.map((p) => scale.x(p.onDate)) : [];
  const pickedPoint = picked !== null ? shown[picked] : undefined;
  // A few values (check-ins, best sets) as dots; a daily course (weight) as a line only.
  const dots = shown.length <= 12;
  const label = (v: number) => formatGoalNumber(v, goal.unit);

  const path = scale
    ? shown
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${String(xs[i])},${String(scale.y(p.value))}`)
        .join(' ')
    : '';

  return (
    <div className="flex flex-col gap-2">
      <p className="min-h-5 text-footnote text-text-muted tabular-nums" aria-live="polite">
        {pickedPoint
          ? [
              formatGoalDay(pickedPoint.onDate, today),
              formatGoalValue(pickedPoint.value, goal.unit),
              pickedPoint.expectedValue !== null &&
                `Linie ${formatGoalNumber(pickedPoint.expectedValue, goal.unit)}`,
            ]
              .filter(Boolean)
              .join(' · ')
          : shown.length > 0
            ? 'Antippen für Werte'
            : 'Noch keine Werte seit dem Start'}
      </p>
      <div ref={ref} className="h-chart w-full">
        {scale && (
          <svg
            role="img"
            aria-label="Verlauf gegen die Ziellinie"
            width={width}
            height={HEIGHT}
            className="block touch-pan-y select-none"
            {...pickHandlers(xs, setPicked)}
          >
            {goal.startValue !== null && (
              <AxisLabel y={scale.y(goal.startValue)}>{label(goal.startValue)}</AxisLabel>
            )}
            {goal.targetValue !== null && (
              <AxisLabel y={scale.y(goal.targetValue)} strong>
                {label(goal.targetValue)}
              </AxisLabel>
            )}
            <text x={BOX.left} y={HEIGHT - 4} className="fill-text-subtle text-caption">
              {formatGoalDay(goal.startsOn, today)}
            </text>
            <text
              x={width - BOX.right}
              y={HEIGHT - 4}
              textAnchor="end"
              className="fill-text-subtle text-caption"
            >
              {formatGoalDay(goal.endsOn, today)}
            </text>

            {goal.minValue !== null && (
              <line
                x1={BOX.left}
                x2={width - BOX.right}
                y1={scale.y(goal.minValue)}
                y2={scale.y(goal.minValue)}
                className="stroke-text-subtle"
                strokeWidth={1}
                strokeDasharray="1 4"
                strokeLinecap="round"
              />
            )}
            {line && (
              <line
                x1={scale.x(line[0].onDate)}
                y1={scale.y(line[0].value)}
                x2={scale.x(line[1].onDate)}
                y2={scale.y(line[1].value)}
                className="stroke-text-muted"
                strokeWidth={1.5}
                strokeDasharray="5 5"
              />
            )}
            {today >= goal.startsOn && today <= goal.endsOn && (
              <line
                x1={scale.x(today)}
                x2={scale.x(today)}
                y1={BOX.top}
                y2={HEIGHT - BOX.bottom}
                className="stroke-border"
                strokeWidth={1}
              />
            )}
            {pickedPoint && picked !== null && (
              <line
                x1={xs[picked]}
                x2={xs[picked]}
                y1={BOX.top}
                y2={HEIGHT - BOX.bottom}
                className="stroke-text-subtle"
                strokeWidth={1}
              />
            )}

            {shown.length > 1 && (
              <path
                d={path}
                fill="none"
                className="stroke-accent"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {shown.map((p, i) =>
              dots || shown.length === 1 || i === picked ? (
                <circle
                  key={p.onDate}
                  cx={xs[i]}
                  cy={scale.y(p.value)}
                  r={i === picked ? 5 : 3.5}
                  className="fill-accent stroke-surface"
                  strokeWidth={i === picked ? 2 : 0}
                />
              ) : null,
            )}
          </svg>
        )}
      </div>
      <Legend minimum={goal.minValue !== null} kind="level" />
    </div>
  );
}

const barClass: Record<GoalPointState, string> = {
  target_reached: 'fill-accent',
  min_reached: 'fill-text-muted',
  below_min: 'fill-text-subtle',
  not_reached: 'fill-text-subtle',
  open: 'fill-surface-3',
  paused: 'fill-surface-3',
};

/**
 * Rates: one bar per week of the period (weeks to come stay empty), the target dashed and
 * the minimum dotted across. Reached weeks in the accent; the week's state is in the line
 * above when picked.
 */
function RateChart({
  goal,
  points,
  today,
}: {
  goal: Goal;
  points: GoalHistoryPoint[];
  today: string;
}) {
  const [ref, width] = useWidth();
  const weeks = rateWeeks(goal, points);
  const [picked, setPicked] = useState<number | null>(null);
  const scale =
    width > 0 ? barChartScale(weeks, goal.targetValue, { width, height: HEIGHT, ...BOX }) : null;
  const pickedWeek = picked !== null ? weeks[picked] : undefined;
  const trainings = goal.metric === 'trainings_per_week';
  const base = HEIGHT - BOX.bottom;
  const first = weeks[0];
  const last = weeks.at(-1);

  function weekText(): string {
    if (!pickedWeek) return weeks.length > 0 ? 'Antippen für eine Woche' : '';
    const head = `Woche ab ${formatGoalDay(pickedWeek.weekStart, today)}`;
    const p = pickedWeek.point;
    if (!p) return `${head} · kommt noch`;
    const value = trainings
      ? `${formatGoalNumber(p.value, goal.unit)} von ${formatGoalNumber(p.targetValue, goal.unit)}`
      : formatGoalValue(p.value, goal.unit);
    return `${head} · ${value} · ${goalPointStateText(p.state)}`;
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="min-h-5 text-footnote text-text-muted tabular-nums" aria-live="polite">
        {weekText()}
      </p>
      <div ref={ref} className="h-chart w-full">
        {scale && (
          <svg
            role="img"
            aria-label="Wochen im Zeitraum"
            width={width}
            height={HEIGHT}
            className="block touch-pan-y select-none"
            {...pickHandlers(scale.xs, setPicked)}
          >
            {goal.targetValue !== null && (
              <AxisLabel y={scale.y(goal.targetValue)} strong>
                {formatGoalNumber(goal.targetValue, goal.unit)}
              </AxisLabel>
            )}
            {goal.minValue !== null && (
              <AxisLabel y={scale.y(goal.minValue)}>
                {formatGoalNumber(goal.minValue, goal.unit)}
              </AxisLabel>
            )}
            {first && (
              <text x={BOX.left} y={HEIGHT - 4} className="fill-text-subtle text-caption">
                {formatGoalDay(first.weekStart, today)}
              </text>
            )}
            {last && weeks.length > 1 && (
              <text
                x={width - BOX.right}
                y={HEIGHT - 4}
                textAnchor="end"
                className="fill-text-subtle text-caption"
              >
                {formatGoalDay(last.weekStart, today)}
              </text>
            )}
            <line
              x1={BOX.left}
              x2={width - BOX.right}
              y1={base}
              y2={base}
              className="stroke-border"
              strokeWidth={1}
            />

            {weeks.map((week, i) => {
              const bar = scale.bars[i];
              const p = week.point;
              if (!bar) return null;
              const value = p?.value ?? 0;
              // A week without anything done still shows as a sliver, a week to come not at all.
              const top = Math.min(scale.y(value), base - 2);
              return (
                <g key={week.weekStart}>
                  {i === picked && (
                    <rect
                      x={bar.x - 1}
                      y={BOX.top}
                      width={bar.width + 2}
                      height={base - BOX.top}
                      rx={3}
                      className="fill-surface-2"
                    />
                  )}
                  {p && (
                    <rect
                      x={bar.x}
                      y={top}
                      width={bar.width}
                      height={base - top}
                      rx={Math.min(3, bar.width / 3)}
                      className={cn(
                        barClass[p.state ?? 'open'],
                        p.state === 'open' && 'stroke-text-subtle',
                      )}
                      strokeWidth={p.state === 'open' ? 1 : 0}
                    />
                  )}
                </g>
              );
            })}

            {goal.minValue !== null && (
              <line
                x1={BOX.left}
                x2={width - BOX.right}
                y1={scale.y(goal.minValue)}
                y2={scale.y(goal.minValue)}
                className="stroke-text-subtle"
                strokeWidth={1}
                strokeDasharray="1 4"
                strokeLinecap="round"
              />
            )}
            {goal.targetValue !== null && (
              <line
                x1={BOX.left}
                x2={width - BOX.right}
                y1={scale.y(goal.targetValue)}
                y2={scale.y(goal.targetValue)}
                className="stroke-text-muted"
                strokeWidth={1.5}
                strokeDasharray="5 5"
              />
            )}
          </svg>
        )}
      </div>
      <Legend minimum={goal.minValue !== null} kind="rate" />
    </div>
  );
}

function AxisLabel({
  y,
  strong = false,
  children,
}: {
  y: number;
  strong?: boolean;
  children: string;
}) {
  return (
    <text
      x={BOX.left - 6}
      y={y}
      textAnchor="end"
      dominantBaseline="middle"
      className={cn('text-caption', strong ? 'fill-text-muted' : 'fill-text-subtle')}
    >
      {children}
    </text>
  );
}

/** What the lines mean (shapes, not colours). */
function Legend({ minimum, kind }: { minimum: boolean; kind: 'level' | 'rate' }) {
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-text-subtle">
      <span className="flex items-center gap-1.5">
        <svg aria-hidden width="16" height="4" className="overflow-visible">
          <line
            x1={0}
            x2={16}
            y1={2}
            y2={2}
            className="stroke-text-muted"
            strokeWidth={1.5}
            strokeDasharray="5 5"
          />
        </svg>
        {kind === 'level' ? 'Linie zum Ziel' : 'Ziel'}
      </span>
      {minimum && (
        <span className="flex items-center gap-1.5">
          <svg aria-hidden width="16" height="4" className="overflow-visible">
            <line
              x1={0}
              x2={16}
              y1={2}
              y2={2}
              className="stroke-text-subtle"
              strokeWidth={1.5}
              strokeDasharray="1 4"
              strokeLinecap="round"
            />
          </svg>
          Mindestziel
        </span>
      )}
    </p>
  );
}
