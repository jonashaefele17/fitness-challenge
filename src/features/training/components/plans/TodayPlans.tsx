import { useState } from 'react';
import { usePlanOccurrences } from '../../api/usePlans';
import type { PlanOccurrence } from '../../types';
import { TrainingTypeIcon } from '../TrainingTypeIcon';
import { PlanDetailSheet } from './PlanDetailSheet';
import { PlanStartButton } from './PlanStartButton';
import { planTitle } from './planText';

function todayKey(): string {
  const now = new Date();
  return `${String(now.getFullYear())}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** "Heute geplant": today's open plans, a training starts with one tap. */
export function TodayPlans() {
  const [today] = useState(todayKey);
  const [range] = useState(() => {
    const day = new Date(`${today}T12:00:00`);
    return { from: day, to: day };
  });
  const plans = (usePlanOccurrences(range).data ?? []).filter((p) => p.status === 'planned');
  const [open, setOpen] = useState<PlanOccurrence | null>(null);
  if (plans.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-footnote font-semibold text-text-muted">Heute geplant</h2>
      <ul className="flex flex-col gap-2">
        {plans.map((plan) => (
          <li
            key={`${plan.planId}:${plan.planDate}`}
            className="flex min-h-tap items-center gap-3 rounded-card bg-surface-2 px-4 py-3"
          >
            <button
              type="button"
              onClick={() => {
                setOpen(plan);
              }}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-surface-3 text-accent">
                {plan.kind === 'event' ? (
                  <span aria-hidden>★</span>
                ) : (
                  <TrainingTypeIcon
                    icon={plan.trainingType?.icon ?? 'generic'}
                    className="size-5"
                  />
                )}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-subhead font-semibold">
                  {[planTitle(plan), plan.focus?.name].filter(Boolean).join(' · ')}
                </span>
                {plan.startTime && (
                  <span className="text-footnote text-text-muted">{plan.startTime} Uhr</span>
                )}
              </span>
            </button>
            {plan.kind === 'training' && plan.trainingType && <PlanStartButton plan={plan} />}
          </li>
        ))}
      </ul>
      <PlanDetailSheet
        plan={open}
        today={today}
        onClose={() => {
          setOpen(null);
        }}
      />
    </section>
  );
}
