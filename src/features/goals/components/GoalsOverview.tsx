import { useEffect, useState, type ReactNode } from 'react';
import { Button, ChevronRightIcon, PlusIcon, Sheet } from '@/shared/ui';
import { useGoals } from '../api/useGoals';
import { todayKey } from '../dates';
import { goalTitle, rateSummaryText, thisWeekText } from '../format';
import type { Goal, GoalFrame } from '../types';
import { formatGoalDay, formatGoalPeriod, periodStateText, splitGoals } from '../view';
import { GoalCreateFlow } from './GoalCreateFlow';
import { GoalDetailSheet } from './GoalDetailSheet';
import { GoalProgressBar, GoalStatusLine, GoalValues } from './GoalBits';

/**
 * Ich → Ziele: my running and upcoming goals as calm cards (start → now → target, a bar
 * with the minimum marked, status), a small "Neues Ziel" in the header, and a quiet row to
 * the ended and archived ones.
 */
export function GoalsOverview({
  header,
  frameOf,
  detailFooter,
  openGoalId = null,
  onGoalOpened,
}: {
  /** Shown above my goals (8b: the current season, mounted from the app). */
  header?: ReactNode;
  /** The frame a goal belongs to (8b: its season), from the app; those come first. */
  frameOf?: (goal: Goal) => GoalFrame | null;
  /** Below a goal's figures in its detail (e.g. comments), from the app. */
  detailFooter?: (goal: Goal) => ReactNode;
  /** A goal to open (a link from a push or the feed): opened once it is loaded. */
  openGoalId?: string | null;
  /** The link was handled (the caller drops it). */
  onGoalOpened?: () => void;
}) {
  const [today] = useState(todayKey);
  // One list with the archived ones: the overview counts them for "Beendet".
  const goals = useGoals({ includeArchived: true });
  const [creating, setCreating] = useState(false);
  const [endedOpen, setEndedOpen] = useState(false);
  // Kept while the sheet closes, so it does not empty on the way out.
  const [shownId, setShownId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const split = splitGoals(goals.data ?? []);
  const framed = (goal: Goal) => (frameOf?.(goal) ? 0 : 1);
  // Goals of a frame (the season) first, otherwise in the module's order.
  const active = [...split.active].sort((a, b) => framed(a) - framed(b));
  const { ended } = split;
  const shown = (goals.data ?? []).find((g) => g.id === shownId) ?? null;

  function open(goal: Goal) {
    setShownId(goal.id);
    setDetailOpen(true);
  }

  // From a link: open the goal once it is there (once per link), then let the caller drop
  // the link (it navigates, so in an effect).
  const linked = openGoalId ? (goals.data?.find((g) => g.id === openGoalId) ?? null) : null;
  const [handledLink, setHandledLink] = useState<string | null>(null);
  const settled = openGoalId !== null && (linked !== null || !goals.isPending);
  if (openGoalId === null && handledLink !== null) setHandledLink(null);
  if (settled && openGoalId !== handledLink) {
    setHandledLink(openGoalId);
    if (linked) open(linked);
  }
  useEffect(() => {
    if (settled) onGoalOpened?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per link
  }, [settled, openGoalId]);

  const newGoal = (
    <Button
      variant="tinted"
      leadingIcon={<PlusIcon aria-hidden />}
      onClick={() => {
        setCreating(true);
      }}
    >
      Neues Ziel
    </Button>
  );

  return (
    <div className="flex flex-col gap-4">
      {header}
      {goals.isPending ? null : goals.isError ? (
        <p className="py-6 text-center text-subhead text-text-subtle">
          Ziele konnten nicht geladen werden.
        </p>
      ) : active.length === 0 ? (
        <section className="flex flex-col items-center gap-4 rounded-card bg-surface-2 px-6 py-8 text-center">
          <div className="flex flex-col gap-1">
            <h2 className="text-body font-semibold">Noch kein Ziel</h2>
            <p className="text-subhead text-text-muted">
              Setz dir ein Ziel für die nächsten Wochen – Trainings pro Woche, dein Gewicht, einen
              Bestwert oder ein Habit.
            </p>
          </div>
          {newGoal}
        </section>
      ) : (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-title-3 font-semibold">Meine Ziele</h2>
            {newGoal}
          </div>
          <ul className="flex flex-col gap-3">
            {active.map((goal) => (
              <li key={goal.id}>
                <GoalCard
                  goal={goal}
                  today={today}
                  frame={frameOf?.(goal) ?? null}
                  onOpen={() => {
                    open(goal);
                  }}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {ended.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setEndedOpen(true);
          }}
          className="flex min-h-tap w-full items-center gap-3 rounded-card bg-surface-2 px-4 py-2 text-left active:bg-surface-3"
        >
          <span className="flex-1 text-body">Beendet</span>
          <span className="text-subhead text-text-muted tabular-nums">{ended.length}</span>
          <ChevronRightIcon aria-hidden className="shrink-0 text-text-subtle" />
        </button>
      )}

      <Sheet open={endedOpen} onOpenChange={setEndedOpen} title="Beendete Ziele">
        <ul className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
          {ended.map((goal) => (
            <li key={goal.id}>
              <button
                type="button"
                onClick={() => {
                  setEndedOpen(false);
                  open(goal);
                }}
                className="flex min-h-tap w-full items-center gap-3 px-4 py-2.5 text-left active:bg-surface-3"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-body">{goalTitle(goal)}</span>
                  <span className="truncate text-footnote text-text-muted">
                    {formatGoalPeriod(goal.startsOn, goal.endsOn, today)}
                    {goal.archivedAt !== null && goal.phase !== 'ended' && ' · vorzeitig beendet'}
                  </span>
                  <GoalStatusLine
                    status={goal.status}
                    onTrack={null}
                    phase="ended"
                    averaged={goal.metric === 'trainings_per_week'}
                  />
                </span>
                <ChevronRightIcon aria-hidden className="shrink-0 text-text-subtle" />
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      <GoalCreateFlow open={creating} onOpenChange={setCreating} />
      <GoalDetailSheet
        goal={shown}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        frame={shown ? (frameOf?.(shown) ?? null) : null}
        footer={shown ? detailFooter?.(shown) : null}
      />
    </div>
  );
}

/** One goal on the overview; a tap opens its detail. */
function GoalCard({
  goal,
  today,
  frame,
  onOpen,
}: {
  goal: Goal;
  today: string;
  frame: GoalFrame | null;
  onOpen: () => void;
}) {
  const title = goalTitle(goal);
  const sub = [
    title !== goal.metricLabel ? goal.metricLabel : null,
    goal.referenceDetail,
    periodStateText(goal, today),
  ]
    .filter(Boolean)
    .join(' · ');
  const summary = rateSummaryText(goal);
  const week = thisWeekText(goal);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full flex-col gap-3 rounded-card bg-surface-2 p-4 text-left active:bg-surface-3"
    >
      <div className="flex w-full items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-body font-semibold">{title}</span>
            {frame && (
              <span className="shrink-0 rounded-pill bg-surface-3 px-2 py-0.5 text-caption font-semibold text-text-muted">
                {frame.tag}
              </span>
            )}
          </span>
          <span className="truncate text-footnote text-text-muted">{sub}</span>
        </div>
        <ChevronRightIcon aria-hidden className="mt-0.5 shrink-0 text-text-subtle" />
      </div>
      <GoalValues goal={goal} />
      <GoalProgressBar goal={goal} />
      {goal.phase === 'upcoming' ? (
        <p className="text-footnote text-text-muted">
          Startet am {formatGoalDay(goal.startsOn, today)}
        </p>
      ) : (
        <div className="flex flex-col gap-0.5">
          {/* Nothing judged yet but a count to show: the count says it. */}
          {(goal.status !== null || !summary) && (
            <GoalStatusLine
              status={goal.status}
              onTrack={goal.onTrack}
              phase={goal.phase}
              averaged={goal.metric === 'trainings_per_week'}
            />
          )}
          {(summary ?? week) && (
            <p className="text-footnote text-text-subtle">
              {[summary, week].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      )}
    </button>
  );
}
