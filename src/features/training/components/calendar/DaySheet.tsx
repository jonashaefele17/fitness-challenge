import { useState } from 'react';
import { cn } from '@/shared/lib';
import { Button, ChevronRightIcon, PlusIcon, Sheet } from '@/shared/ui';
import type { CalendarWorkout, PlanOccurrence } from '../../types';
import { PlanDetailSheet } from '../plans/PlanDetailSheet';
import { PlanForm } from '../plans/PlanForm';
import { emptyPlan } from '../plans/planDraft';
import { planTitle } from '../plans/planText';
import { TrainingTypeIcon } from '../TrainingTypeIcon';
import { WorkoutDetailSheet } from '../workout-detail/WorkoutDetailSheet';
import { DayList } from './DayList';
import { LogPastSheet } from './LogPastSheet';
import { dayTitle, type LogRow } from './logData';

function todayKey(): string {
  const now = new Date();
  return `${String(now.getFullYear())}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

type Adding = 'choose' | 'plan' | 'log' | null;

/**
 * One day from the calendar as a bottom sheet: its plans and workouts (of everyone shown),
 * each opening on top (the day stays open behind it). "+": plan (future), add afterwards
 * (past), or either (today).
 */
export function DaySheet({
  day,
  entries,
  plans = [],
  showNames,
  onClose,
}: {
  /** Day key ("2026-11-21") or null when closed. */
  day: string | null;
  entries: { row: LogRow; workout: CalendarWorkout }[];
  plans?: { row: LogRow; plan: PlanOccurrence }[];
  showNames: boolean;
  onClose: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [openPlan, setOpenPlan] = useState<PlanOccurrence | null>(null);
  const [adding, setAdding] = useState<Adding>(null);
  // A fresh form each time it opens.
  const [round, setRound] = useState(0);
  const [today] = useState(todayKey);
  // Done plans show as their workout.
  const shownPlans = plans.filter((entry) => entry.plan.status !== 'done');

  function add() {
    if (!day) return;
    setRound((r) => r + 1);
    setAdding(day > today ? 'plan' : day < today ? 'log' : 'choose');
  }

  return (
    <Sheet
      open={day !== null}
      onOpenChange={(open) => {
        if (!open) {
          setOpenId(null);
          setOpenPlan(null);
          onClose();
        }
      }}
      title={day ? dayTitle.format(new Date(`${day}T00:00:00`)) : 'Tag'}
      action={
        day ? (
          <button
            type="button"
            aria-label={
              day > today
                ? 'Training planen'
                : day < today
                  ? 'Training nachtragen'
                  : 'Planen oder nachtragen'
            }
            onClick={add}
            className="flex size-tap items-center justify-center rounded-pill text-title-2 text-accent active:bg-surface-2"
          >
            <PlusIcon />
          </button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-2">
        {shownPlans.length > 0 && (
          <ul className="flex flex-col gap-2">
            {shownPlans.map(({ row, plan }) => (
              <li key={`${plan.planId}:${plan.onDate}`}>
                <button
                  type="button"
                  onClick={() => {
                    setOpenPlan(plan);
                  }}
                  className={cn(
                    'flex min-h-tap w-full items-center gap-3 rounded-card border border-dashed border-border px-4 py-3 text-left active:bg-surface-2',
                    plan.status === 'cancelled' && 'opacity-50',
                  )}
                >
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-pill border border-current"
                    style={{ color: row.color }}
                  >
                    {plan.kind === 'event' ? (
                      <span aria-hidden className="text-subhead">
                        ★
                      </span>
                    ) : (
                      <TrainingTypeIcon
                        icon={plan.trainingType?.icon ?? 'generic'}
                        className="size-5"
                      />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-subhead font-semibold">
                      {showNames && <span className="text-text-muted">{row.name} · </span>}
                      {planTitle(plan)}
                    </span>
                    <span className="truncate text-footnote text-text-muted">
                      {[
                        plan.status === 'cancelled' ? 'abgesagt' : 'geplant',
                        plan.startTime ? `${plan.startTime} Uhr` : null,
                        plan.recurring ? 'wöchentlich' : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <ChevronRightIcon aria-hidden className="shrink-0 text-text-subtle" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {(entries.length > 0 || shownPlans.length === 0) && (
          <DayList entries={entries} showNames={showNames} onOpen={setOpenId} />
        )}
      </div>

      {day && (
        <>
          <Sheet
            open={adding === 'choose'}
            onOpenChange={(open) => {
              if (!open) setAdding(null);
            }}
            title="Heute"
          >
            <div className="flex flex-col gap-2">
              <Button
                size="lg"
                onClick={() => {
                  setAdding('plan');
                }}
              >
                Training planen
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => {
                  setAdding('log');
                }}
              >
                Training nachtragen
              </Button>
            </div>
          </Sheet>
          <Sheet
            open={adding === 'plan'}
            onOpenChange={(open) => {
              if (!open) setAdding(null);
            }}
            title="Planen"
          >
            {adding === 'plan' && (
              <PlanForm
                key={round}
                initial={emptyPlan(day)}
                onSaved={() => {
                  setAdding(null);
                }}
              />
            )}
          </Sheet>
          <LogPastSheet
            key={round}
            day={day}
            open={adding === 'log'}
            onOpenChange={(open) => {
              if (!open) setAdding(null);
            }}
          />
        </>
      )}

      <PlanDetailSheet
        plan={openPlan}
        today={today}
        onClose={() => {
          setOpenPlan(null);
        }}
      />
      <WorkoutDetailSheet
        workoutId={openId}
        onClose={() => {
          setOpenId(null);
        }}
      />
    </Sheet>
  );
}
