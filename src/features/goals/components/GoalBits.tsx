import type { ReactNode } from 'react';
import { cn } from '@/shared/lib';
import { Button, CheckIcon, ChevronLeftIcon, NumberWheel } from '@/shared/ui';
import {
  formatGoalNumber,
  formatGoalTarget,
  formatGoalValue,
  goalStatusText,
  onTrackText,
  progressBarPct,
} from '../format';
import type { Goal, GoalMetricKind, GoalStatus, GoalUnit } from '../types';
import { minGoalRange, minMarkerPct, parseGoalNumber, unitCaption, wheelStep } from '../view';

/**
 * A thin bar from start (left) to target (right), filled to the progress; a minimum shows
 * as a small notch (with its own label for screen readers).
 */
export function GoalProgressBar({
  goal,
  className,
}: {
  goal: Pick<Goal, 'metricKind' | 'startValue' | 'minValue' | 'targetValue' | 'progressPct'>;
  className?: string;
}) {
  const pct = progressBarPct(goal.progressPct);
  const marker = minMarkerPct(goal);
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label="Fortschritt zum Ziel"
      className={cn('relative h-1.5 w-full rounded-pill bg-surface-3', className)}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-pill bg-accent"
        style={{ width: `${String(pct)}%` }}
      />
      {marker !== null && (
        <span
          aria-hidden
          className="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-pill bg-text"
          style={{ left: `${String(marker)}%` }}
        />
      )}
    </div>
  );
}

/**
 * The status in words, with a mark that does not depend on colour: a filled check for the
 * target, an outlined one for the minimum, nothing below.
 */
export function GoalStatusLine({
  status,
  onTrack,
  phase,
  averaged = false,
  className,
}: {
  status: GoalStatus | null;
  onTrack: boolean | null;
  phase: Goal['phase'];
  /** The status judges an average over the weeks (trainings per week): say so. */
  averaged?: boolean;
  className?: string;
}) {
  const track = phase === 'running' ? onTrackText(onTrack) : null;
  return (
    <p className={cn('flex min-w-0 items-center gap-1.5 text-footnote', className)}>
      {status === 'target_reached' && (
        <span className="flex size-4 shrink-0 items-center justify-center rounded-pill bg-accent text-on-accent">
          <CheckIcon aria-hidden className="size-3" strokeWidth={3} />
        </span>
      )}
      {status === 'min_reached' && (
        <span className="flex size-4 shrink-0 items-center justify-center rounded-pill border border-text-muted text-text">
          <CheckIcon aria-hidden className="size-3" strokeWidth={3} />
        </span>
      )}
      <span
        className={cn('truncate', status === 'target_reached' ? 'text-text' : 'text-text-muted')}
      >
        {statusText(status, phase, averaged)}
        {track && <span className="text-text-subtle"> · {track}</span>}
      </span>
    </p>
  );
}

/** Weeks are averaged, so single weeks can differ from the status: the words say "im Schnitt". */
const AVERAGED_STATUS: Record<GoalStatus, string> = {
  target_reached: 'Im Schnitt Ziel erreicht',
  min_reached: 'Im Schnitt Mindestziel erreicht',
  below_min: 'Im Schnitt unter dem Mindestziel',
  not_reached: 'Im Schnitt unter dem Ziel',
};

/**
 * While a goal runs, "below the minimum" is not a verdict yet: it says what is still open.
 */
function statusText(status: GoalStatus | null, phase: Goal['phase'], averaged: boolean): string {
  if (averaged && status !== null) return AVERAGED_STATUS[status];
  if (phase === 'running' && status === 'below_min') return 'Mindestziel noch nicht erreicht';
  return goalStatusText(status);
}

/**
 * Levels: "84,0 → 82,1 → 78,0 kg" (start → now → target, now emphasised).
 * Rates: "Ø 2,5 pro Woche · Ziel 4" / "78 % · Ziel 90 %".
 */
export function GoalValues({ goal, className }: { goal: Goal; className?: string }) {
  if (goal.metricKind === 'rate') {
    const value = (v: number | null) =>
      goal.unit === 'percent' ? formatGoalValue(v, goal.unit) : formatGoalNumber(v, goal.unit);
    const target = `Ziel ${goal.unit === 'per_week' ? formatGoalValue(goal.targetValue, goal.unit) : value(goal.targetValue)}${
      goal.minValue !== null ? ` (mind. ${value(goal.minValue)})` : ''
    }`;
    return (
      <p className={cn('text-subhead tabular-nums', className)}>
        {goal.currentValue !== null && (
          <span className="font-semibold text-text">
            {goal.unit === 'per_week'
              ? `Ø ${formatGoalNumber(goal.currentValue, goal.unit)}`
              : formatGoalValue(goal.currentValue, goal.unit)}
            {' · '}
          </span>
        )}
        <span className="text-text-muted">{target}</span>
      </p>
    );
  }
  // Seconds read as "1:30 min": every value with its unit. Others: the unit once at the end.
  const each = goal.unit === 'seconds';
  const value = (v: number | null) =>
    each ? formatGoalValue(v, goal.unit) : formatGoalNumber(v, goal.unit);
  const target = each ? value(goal.targetValue) : formatGoalTarget(goal.targetValue, goal);
  if (goal.currentValue === null) {
    // Nothing measured since the start yet: no dash in the middle.
    return (
      <p className={cn('text-subhead text-text-muted tabular-nums', className)}>
        Start {value(goal.startValue)} · Ziel {target}
      </p>
    );
  }
  return (
    <p className={cn('text-subhead tabular-nums', className)}>
      <span className="text-text-muted">{value(goal.startValue)} → </span>
      <span className="font-semibold text-text">{value(goal.currentValue)}</span>
      <span className="text-text-muted"> → {target}</span>
    </p>
  );
}

/** Top line of a flow screen: "Zurück" on the left, a counter on the right. */
export function FlowStepHeader({
  onBack,
  counter,
}: {
  onBack: (() => void) | undefined;
  counter?: string | null;
}) {
  return (
    <div className="flex min-h-tap items-center justify-between">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="-ml-2 flex min-h-tap items-center gap-1 rounded-pill px-2 text-subhead font-semibold text-accent active:bg-surface-2"
        >
          <ChevronLeftIcon aria-hidden /> Zurück
        </button>
      ) : (
        <span />
      )}
      {counter && <span className="text-footnote text-text-muted">{counter}</span>}
    </div>
  );
}

/** A number wheel for a goal value (German decimals, typing allowed). */
export function GoalValueWheel({
  value,
  suggested = false,
  step,
  emptyStart,
  unit,
  label,
  min,
  max,
  onChange,
}: {
  value: number | null;
  suggested?: boolean;
  step: number;
  emptyStart: number;
  unit: GoalUnit;
  label: string;
  min?: number | undefined;
  max?: number | undefined;
  onChange: (value: number) => void;
}) {
  return (
    <NumberWheel
      value={value}
      suggested={suggested}
      step={step}
      emptyStart={emptyStart}
      label={label}
      {...(min === undefined ? {} : { min })}
      {...(max === undefined ? {} : { max })}
      format={(v) => (unit === 'seconds' ? String(Math.round(v)) : formatGoalNumber(v, unit))}
      parse={(text) => parseGoalNumber(text) ?? Number.NaN}
      onChange={(next) => {
        if (Number.isFinite(next) && next >= 0) onChange(Math.round(next * 100) / 100);
      }}
    />
  );
}

/** A labelled card around a value wheel (target and minimum side by side). */
export function GoalValueCard({
  label,
  unit,
  action,
  children,
}: {
  label: string;
  unit: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-card bg-surface-2 pt-2 pb-3">
      <div className="flex min-h-tap w-full items-center justify-between gap-1 pr-1 pl-3">
        <span className="flex flex-col">
          <span className="text-footnote font-semibold">{label}</span>
          <span className="text-caption text-text-muted">{unit}</span>
        </span>
        {action}
      </div>
      {children}
    </div>
  );
}

/**
 * The optional minimum: without one the card offers to set it – no empty wheel. With one,
 * the wheel only reaches values on the easier side of the target.
 */
export function MinGoalCard({
  metric,
  kind,
  unit,
  start,
  target,
  value,
  onChange,
}: {
  metric: string;
  kind: GoalMetricKind;
  unit: GoalUnit;
  start: number | null;
  target: number | null;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const step = wheelStep(metric, unit, 'goal');
  const range = minGoalRange(kind, start, target, step);
  const caption = unitCaption(unit);
  return (
    <GoalValueCard
      label="Mindestziel"
      unit={value === null ? 'optional' : caption}
      action={
        value !== null ? (
          <button
            type="button"
            onClick={() => {
              onChange(null);
            }}
            className="min-h-tap px-2 text-footnote font-semibold text-accent"
          >
            Entfernen
          </button>
        ) : null
      }
    >
      {value === null ? (
        <div className="flex h-wheel items-center">
          <Button
            variant="tinted"
            missing={
              target === null
                ? 'Stell zuerst das Ziel ein.'
                : range === null
                  ? kind === 'level'
                    ? 'Zwischen Start und Ziel ist kein Platz für ein Mindestziel.'
                    : 'Unter diesem Ziel ist kein Platz für ein Mindestziel.'
                  : null
            }
            onClick={() => {
              if (range) onChange(range.initial);
            }}
          >
            Festlegen
          </Button>
        </div>
      ) : (
        <GoalValueWheel
          value={value}
          step={step}
          emptyStart={value}
          unit={unit}
          label={`Mindestziel ${caption}`}
          min={range?.min}
          max={range?.max}
          onChange={onChange}
        />
      )}
    </GoalValueCard>
  );
}
