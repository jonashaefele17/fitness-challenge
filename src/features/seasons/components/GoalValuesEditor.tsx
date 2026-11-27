import type { ReactNode } from 'react';
import {
  GoalValueWheel,
  snapToStep,
  targetWheelStart,
  unitCaption,
  wheelStep,
  type GoalMetricKind,
  type GoalUnit,
} from '@/features/goals';

export interface GoalValues {
  start: number | null;
  target: number | null;
  min: number | null;
}

/**
 * Target and minimum (and the start for levels when `withStart`) as number wheels side by
 * side – the season's training goal, a habit quota, an admin's correction.
 */
export function GoalValuesEditor({
  metric,
  kind,
  unit,
  values,
  withStart = false,
  onChange,
}: {
  metric: string;
  kind: GoalMetricKind;
  unit: GoalUnit;
  values: GoalValues;
  withStart?: boolean;
  onChange: (values: GoalValues) => void;
}) {
  const goalStep = wheelStep(metric, unit, 'goal');
  const minStart =
    values.target === null
      ? 0
      : kind === 'level' && values.start !== null
        ? snapToStep((values.start + values.target) / 2, goalStep)
        : Math.max(0, values.target - goalStep);
  const caption = unitCaption(unit);
  return (
    <div className="flex flex-col gap-3">
      {withStart && kind === 'level' && (
        <ValueCard label="Start" unit={caption}>
          <GoalValueWheel
            value={values.start}
            step={wheelStep(metric, unit, 'start')}
            emptyStart={0}
            unit={unit}
            label={`Start ${caption}`}
            onChange={(start) => {
              onChange({ ...values, start });
            }}
          />
        </ValueCard>
      )}
      <div className="grid grid-cols-2 gap-3">
        <ValueCard label="Ziel" unit={caption}>
          <GoalValueWheel
            value={values.target}
            step={goalStep}
            emptyStart={targetWheelStart({ key: metric, kind }, unit, values.start)}
            unit={unit}
            label={`Ziel ${caption}`}
            onChange={(target) => {
              onChange({ ...values, target });
            }}
          />
        </ValueCard>
        <ValueCard
          label="Mindestziel"
          unit={`${caption} · optional`}
          action={
            values.min !== null ? (
              <button
                type="button"
                onClick={() => {
                  onChange({ ...values, min: null });
                }}
                className="min-h-tap px-2 text-footnote font-semibold text-accent"
              >
                Entfernen
              </button>
            ) : null
          }
        >
          <GoalValueWheel
            value={values.min}
            step={goalStep}
            emptyStart={minStart}
            unit={unit}
            label={`Mindestziel ${caption}`}
            onChange={(min) => {
              onChange({ ...values, min });
            }}
          />
        </ValueCard>
      </div>
    </div>
  );
}

function ValueCard({
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
