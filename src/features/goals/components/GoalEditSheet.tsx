import { useState } from 'react';
import { Button, Sheet } from '@/shared/ui';
import { todayKey } from '../dates';
import { formatGoalTarget } from '../format';
import { validateGoalValues, validatePeriod } from '../goal';
import type { Goal, GoalVisibility, UpdateGoalInput } from '../types';
import {
  fitMinGoal,
  minGoalRange,
  sharingNote,
  targetWheelStart,
  unitCaption,
  wheelStep,
} from '../view';
import { DateRow, VisibilityChoice } from './GoalFields';
import { GoalValueCard, GoalValueWheel, MinGoalCard } from './GoalBits';

interface Draft {
  target: number | null;
  min: number | null;
  startsOn: string;
  endsOn: string;
  visibility: GoalVisibility;
}

const draftOf = (goal: Goal): Draft => ({
  target: goal.targetValue,
  min: goal.minValue,
  startsOn: goal.startsOn,
  endsOn: goal.endsOn,
  visibility: goal.visibility,
});

/**
 * Change target, minimum, period and visibility. Target and minimum become a new version
 * from today: the weeks before keep being judged by the old values.
 */
export function GoalEditSheet({
  goal,
  open,
  onOpenChange,
  onSave,
  periodFixed = false,
}: {
  goal: Goal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: UpdateGoalInput) => void;
  /** Period and visibility come from a frame (a season): only the values change here. */
  periodFixed?: boolean;
}) {
  const [today] = useState(todayKey);
  const [draft, setDraft] = useState<Draft>(() => draftOf(goal));
  // A fresh copy each time it opens (state adjusted while rendering).
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(draftOf(goal));
  }
  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
  };

  const kind = { key: goal.metric, kind: goal.metricKind };
  const goalStep = wheelStep(goal.metric, goal.unit, 'goal');
  const error =
    validateGoalValues(kind, {
      startValue: goal.startValue,
      minValue: draft.min,
      targetValue: draft.target,
    }) ?? validatePeriod(draft.startsOn, draft.endsOn);
  const valuesChanged = draft.target !== goal.targetValue || draft.min !== goal.minValue;
  const changed =
    valuesChanged ||
    draft.startsOn !== goal.startsOn ||
    draft.endsOn !== goal.endsOn ||
    draft.visibility !== goal.visibility;
  return (
    <Sheet
      fullHeight
      open={open}
      onOpenChange={onOpenChange}
      title="Ziel bearbeiten"
      footer={
        <div className="flex flex-col gap-2">
          {valuesChanged && goal.startsOn < today && (
            <p className="text-center text-footnote text-text-muted">
              Neue Werte gelten ab heute – vergangene Wochen zählen nach den alten.
            </p>
          )}
          <Button
            size="lg"
            fullWidth
            missing={error ?? (changed ? null : 'Du hast nichts geändert.')}
            onClick={() => {
              if (draft.target === null) return;
              onSave({
                goalId: goal.id,
                startsOn: draft.startsOn,
                endsOn: draft.endsOn,
                startValue: goal.startValue,
                minValue: draft.min,
                targetValue: draft.target,
                visibility: draft.visibility,
                validFrom: today < draft.startsOn ? draft.startsOn : today,
              });
            }}
          >
            Speichern
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {goal.metricKind === 'level' && (
          <p className="text-subhead text-text-muted">
            Start: {formatGoalTarget(goal.startValue, goal)}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <GoalValueCard label="Ziel" unit={unitCaption(goal.unit)}>
            <GoalValueWheel
              value={draft.target}
              step={goalStep}
              emptyStart={targetWheelStart(kind, goal.unit, goal.startValue)}
              unit={goal.unit}
              label={`Ziel ${unitCaption(goal.unit)}`}
              onChange={(target) => {
                set({
                  target,
                  min: fitMinGoal(
                    draft.min,
                    minGoalRange(goal.metricKind, goal.startValue, target, goalStep),
                  ),
                });
              }}
            />
          </GoalValueCard>
          <MinGoalCard
            metric={goal.metric}
            kind={goal.metricKind}
            unit={goal.unit}
            start={goal.startValue}
            target={draft.target}
            value={draft.min}
            onChange={(min) => {
              set({ min });
            }}
          />
        </div>
        {periodFixed ? (
          <p className="text-footnote text-text-muted">
            Zeitraum und Sichtbarkeit gibt die Saison vor.
          </p>
        ) : (
          <>
            <ul className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
              <DateRow
                label="Start"
                day={draft.startsOn}
                today={today}
                onChange={(startsOn) => {
                  set({ startsOn });
                }}
              />
              <DateRow
                label="Ende"
                day={draft.endsOn}
                today={today}
                min={draft.startsOn}
                onChange={(endsOn) => {
                  set({ endsOn });
                }}
              />
            </ul>
            <VisibilityChoice
              value={draft.visibility}
              note={sharingNote(goal.metric)}
              onChange={(visibility) => {
                set({ visibility });
              }}
            />
          </>
        )}
        {error && changed && <p className="text-footnote text-danger">{error}</p>}
      </div>
    </Sheet>
  );
}
