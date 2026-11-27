import {
  fitMinGoal,
  GoalValueCard,
  GoalValueWheel,
  MinGoalCard,
  minGoalRange,
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
  const caption = unitCaption(unit);
  return (
    <div className="flex flex-col gap-3">
      {withStart && kind === 'level' && (
        <GoalValueCard label="Start" unit={caption}>
          <GoalValueWheel
            value={values.start}
            step={wheelStep(metric, unit, 'start')}
            emptyStart={0}
            unit={unit}
            label={`Start ${caption}`}
            onChange={(start) => {
              onChange({
                ...values,
                start,
                min: fitMinGoal(values.min, minGoalRange(kind, start, values.target, goalStep)),
              });
            }}
          />
        </GoalValueCard>
      )}
      <div className="grid grid-cols-2 gap-3">
        <GoalValueCard label="Ziel" unit={caption}>
          <GoalValueWheel
            value={values.target}
            step={goalStep}
            emptyStart={targetWheelStart({ key: metric, kind }, unit, values.start)}
            unit={unit}
            label={`Ziel ${caption}`}
            onChange={(target) => {
              onChange({
                ...values,
                target,
                min: fitMinGoal(values.min, minGoalRange(kind, values.start, target, goalStep)),
              });
            }}
          />
        </GoalValueCard>
        <MinGoalCard
          metric={metric}
          kind={kind}
          unit={unit}
          start={values.start}
          target={values.target}
          value={values.min}
          onChange={(min) => {
            onChange({ ...values, min });
          }}
        />
      </div>
    </div>
  );
}
