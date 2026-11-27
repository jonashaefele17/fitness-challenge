import { useState } from 'react';
import { goalTitle, validateGoalValues, type Goal } from '@/features/goals';
import { showToast } from '@/shared/lib';
import { Button, Sheet } from '@/shared/ui';
import { useCorrectSeasonGoal } from '../api/useSeasons';
import { seasonErrorText } from '../format';
import { correctionUndoOf } from '../season';
import { GoalValuesEditor, type GoalValues } from './GoalValuesEditor';

/**
 * Group admins: correct the values of a participant's locked season goal (start, target,
 * minimum – for the whole season). The feed says that it was corrected, never the values.
 * Saved at once with "Rückgängig" (itself another visible correction).
 */
export function GoalCorrectionSheet({
  goal,
  ownerName,
  open,
  onOpenChange,
}: {
  /** Kept by the caller while the sheet closes. */
  goal: Goal | null;
  ownerName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // Lives outside the content so "Rückgängig" works after closing.
  const correct = useCorrectSeasonGoal();
  const [values, setValues] = useState<GoalValues>({ start: null, target: null, min: null });
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open && goal) {
      setValues({ start: goal.startValue, target: goal.targetValue, min: goal.minValue });
    }
  }
  const error = goal
    ? validateGoalValues(
        { key: goal.metric, kind: goal.metricKind },
        { startValue: values.start, minValue: values.min, targetValue: values.target },
      )
    : null;
  const changed =
    goal !== null &&
    (values.start !== goal.startValue ||
      values.target !== goal.targetValue ||
      values.min !== goal.minValue);

  function save() {
    if (!goal || values.target === null) return;
    const undo = correctionUndoOf(goal);
    onOpenChange(false);
    const refused = (fallback: string) => (e: unknown) => {
      showToast(seasonErrorText(e) ?? fallback);
    };
    correct.mutate(
      {
        goalId: goal.id,
        startValue: goal.metricKind === 'level' ? values.start : goal.startValue,
        minValue: values.min,
        targetValue: values.target,
      },
      { onError: refused('Korrektur konnte nicht gespeichert werden.') },
    );
    showToast(
      'Ziel korrigiert',
      undo
        ? {
            label: 'Rückgängig',
            onAction: () => {
              correct.mutate(undo, { onError: refused('Konnte nicht rückgängig gemacht werden.') });
            },
          }
        : undefined,
    );
  }

  return (
    <Sheet
      fullHeight
      open={open && goal !== null}
      onOpenChange={onOpenChange}
      title="Ziel korrigieren"
      footer={
        <Button
          size="lg"
          fullWidth
          missing={error ?? (changed ? null : 'Du hast nichts geändert.')}
          onClick={save}
        >
          Korrigieren
        </Button>
      }
    >
      {goal && (
        <div className="flex flex-col gap-4 pt-1">
          <p className="text-subhead text-text-muted">
            {ownerName} · {goalTitle(goal)}
          </p>
          <GoalValuesEditor
            metric={goal.metric}
            kind={goal.metricKind}
            unit={goal.unit}
            values={values}
            withStart
            onChange={setValues}
          />
          <p className="text-footnote text-text-muted">
            Die Korrektur gilt für die ganze Saison. Im Feed steht, dass du das Ziel korrigiert hast
            – ohne Werte. {ownerName} bekommt Bescheid.
          </p>
        </div>
      )}
    </Sheet>
  );
}
