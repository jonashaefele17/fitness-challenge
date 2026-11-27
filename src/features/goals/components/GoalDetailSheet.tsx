import { useState } from 'react';
import { showToast } from '@/shared/lib';
import { Button, Sheet } from '@/shared/ui';
import { useArchiveGoal, useGoalHistory, useRestoreGoal, useUpdateGoal } from '../api/useGoals';
import { todayKey } from '../dates';
import {
  formatBestSet,
  formatGoalTarget,
  formatGoalValue,
  formatProgress,
  goalTitle,
  rateSummaryText,
  thisWeekText,
} from '../format';
import { undoGoalUpdate } from '../goal';
import type { Goal, UpdateGoalInput } from '../types';
import { formatGoalDay, formatGoalPeriod, periodStateText } from '../view';
import { GoalChart } from './GoalChart';
import { GoalEditSheet } from './GoalEditSheet';
import { GoalProgressBar, GoalStatusLine } from './GoalBits';

/**
 * A goal in detail: where it stands now, the figures, its course against the line, and
 * "Bearbeiten" / "Ziel beenden" (archived ones: "Wieder aufnehmen"). Changes and ending
 * apply at once with "Rückgängig".
 */
export function GoalDetailSheet({
  goal,
  open,
  onOpenChange,
}: {
  /** Kept by the caller while the sheet closes. */
  goal: Goal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // The mutations live here, outside the sheet's content, so "Rückgängig" still works after
  // the sheet has closed.
  const update = useUpdateGoal();
  const archive = useArchiveGoal();
  const restore = useRestoreGoal();
  const [today] = useState(todayKey);
  const [editing, setEditing] = useState(false);
  const history = useGoalHistory(open && goal ? goal.id : null);

  function save(input: UpdateGoalInput) {
    if (!goal) return;
    const previous = goal;
    setEditing(false);
    update.mutate(input, {
      onError: () => {
        showToast('Änderung konnte nicht gespeichert werden.');
      },
    });
    showToast('Ziel geändert', {
      label: 'Rückgängig',
      onAction: () => {
        update.mutate(undoGoalUpdate(previous, input, today));
      },
    });
  }

  function end(target: Goal) {
    onOpenChange(false);
    archive.mutate(target.id, {
      onError: () => {
        showToast('Ziel konnte nicht beendet werden.');
      },
    });
    showToast('Ziel beendet', {
      label: 'Rückgängig',
      onAction: () => {
        restore.mutate(target);
      },
    });
  }

  function resume(target: Goal) {
    onOpenChange(false);
    restore.mutate(target, {
      onError: () => {
        showToast('Ziel konnte nicht wieder aufgenommen werden.');
      },
    });
    showToast('Ziel wieder aufgenommen', {
      label: 'Rückgängig',
      onAction: () => {
        archive.mutate(target.id);
      },
    });
  }

  return (
    <Sheet
      open={open && goal !== null}
      onOpenChange={onOpenChange}
      title={goal ? goalTitle(goal) : 'Ziel'}
      className="min-h-sheet-min"
    >
      {goal && (
        <div className="flex flex-col gap-5">
          <Figures goal={goal} today={today} />
          <section className="flex flex-col gap-2 rounded-card bg-surface-2 px-4 pt-3 pb-3">
            <h3 className="text-subhead font-semibold">Verlauf</h3>
            {history.isPending ? (
              <div className="h-chart" />
            ) : (
              <GoalChart goal={goal} points={history.data ?? []} today={today} />
            )}
          </section>
          <Rows goal={goal} today={today} />
          {goal.archivedAt === null ? (
            <div className="flex flex-col gap-2">
              <Button
                variant="tinted"
                fullWidth
                onClick={() => {
                  setEditing(true);
                }}
              >
                Bearbeiten
              </Button>
              <Button
                variant="danger"
                fullWidth
                onClick={() => {
                  end(goal);
                }}
              >
                {goal.phase === 'ended' ? 'Archivieren' : 'Ziel beenden'}
              </Button>
            </div>
          ) : (
            <Button
              variant="tinted"
              fullWidth
              onClick={() => {
                resume(goal);
              }}
            >
              Wieder aufnehmen
            </Button>
          )}
          <GoalEditSheet
            goal={goal}
            open={open && editing}
            onOpenChange={setEditing}
            onSave={save}
          />
        </div>
      )}
    </Sheet>
  );
}

/** The current value large, what it is, and the progress. */
function Figures({ goal, today }: { goal: Goal; today: string }) {
  const value =
    goal.metricKind === 'rate' && goal.unit === 'per_week' && goal.currentValue !== null
      ? `Ø ${formatGoalValue(goal.currentValue, goal.unit)}`
      : formatGoalTarget(goal.currentValue, goal);
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="text-footnote text-text-muted">{currentLabel(goal, today)}</span>
          <span className="truncate text-title-1 font-bold tabular-nums">{value}</span>
        </div>
        <span className="shrink-0 text-title-3 font-semibold text-text-muted tabular-nums">
          {formatProgress(goal.progressPct)}
        </span>
      </div>
      <GoalProgressBar goal={goal} />
      {goal.phase === 'upcoming' ? (
        <p className="text-footnote text-text-muted">
          Startet am {formatGoalDay(goal.startsOn, today)}
        </p>
      ) : (
        <GoalStatusLine
          status={goal.status}
          onTrack={goal.onTrack}
          // Ended early: judged as it stands, no "on course" any more.
          phase={goal.archivedAt !== null ? 'ended' : goal.phase}
        />
      )}
    </section>
  );
}

function currentLabel(goal: Goal, today: string): string {
  const on =
    goal.currentOn && goal.currentOn !== today ? ` · ${formatGoalDay(goal.currentOn, today)}` : '';
  switch (goal.metric) {
    case 'body_weight':
      return `Jetzt (Ø 7 Tage)${on}`;
    case 'exercise_best':
      return goal.bestSet
        ? `Bester Satz seit dem Start: ${formatBestSet(goal.bestSet)}`
        : 'Bester Satz seit dem Start';
    case 'body_measurement':
      return `Letzter Zwischenstand${on}`;
    case 'trainings_per_week':
      return 'Pro Woche bisher';
    case 'habit_rate':
      return 'Quote bisher';
    default:
      return 'Jetzt';
  }
}

/** The figures as rows: start, minimum, target, line today, period, visibility. */
function Rows({ goal, today }: { goal: Goal; today: string }) {
  const rows: { label: string; value: string }[] = [];
  if (goal.metricKind === 'level') {
    rows.push({ label: 'Start', value: formatGoalTarget(goal.startValue, goal) });
  } else if (goal.startValue !== null) {
    rows.push({
      label: 'Vorher',
      value:
        goal.unit === 'per_week'
          ? `Ø ${formatGoalValue(goal.startValue, goal.unit)}`
          : formatGoalValue(goal.startValue, goal.unit),
    });
  }
  if (goal.minValue !== null) {
    rows.push({ label: 'Mindestziel', value: formatGoalTarget(goal.minValue, goal) });
  }
  rows.push({ label: 'Ziel', value: formatGoalTarget(goal.targetValue, goal) });
  if (
    goal.metricKind === 'level' &&
    goal.phase === 'running' &&
    goal.archivedAt === null &&
    goal.expectedValue !== null
  ) {
    rows.push({ label: 'Linie heute', value: formatGoalTarget(goal.expectedValue, goal) });
  }
  const summary = rateSummaryText(goal);
  const week = thisWeekText(goal);
  return (
    <section className="flex flex-col gap-2">
      <ul className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
        {rows.map((row) => (
          <Row key={row.label} label={row.label} value={row.value} />
        ))}
        <Row
          label="Zeitraum"
          value={`${formatGoalPeriod(goal.startsOn, goal.endsOn, today)} · ${
            goal.archivedAt !== null && goal.phase !== 'ended'
              ? 'vorzeitig beendet'
              : periodStateText(goal, today)
          }`}
        />
        <Row label="Sichtbar für" value={goal.visibility === 'shared' ? 'Gruppe' : 'Nur mich'} />
      </ul>
      {(summary ?? week) && (
        <p className="px-1 text-footnote text-text-muted">
          {[summary, week].filter(Boolean).join(' · ')}
        </p>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex min-h-tap items-center gap-3 px-4 py-2">
      <span className="shrink-0 text-body">{label}</span>
      <span className="min-w-0 flex-1 text-right text-subhead text-text-muted tabular-nums">
        {value}
      </span>
    </li>
  );
}
