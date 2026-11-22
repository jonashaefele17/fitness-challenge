import { useContext, useState } from 'react';
import { useNavigate } from 'react-router';
import { useUserId } from '@/features/auth';
import {
  formatDuration,
  elapsedSeconds,
  planTitle,
  PlanPeopleAvatars,
  PlanSocialContext,
  PlanStartButton,
  StartTrainingSheet,
  TrainingTypeIcon,
  useActiveWorkout,
  usePlanOccurrences,
} from '@/features/training';
import { Button } from '@/shared/ui';
import { paths } from '../paths';
import { targetParams } from '../targets';

const card = 'flex flex-col gap-4 rounded-card border border-accent/40 bg-surface-2 p-4';
const label = 'text-footnote font-semibold text-accent';

/**
 * The one big card on Heute, always the most important thing right now: a running
 * training, else today's plan (with whom, start), else an invitation to train.
 */
export function TodayHero() {
  const navigate = useNavigate();
  const userId = useUserId();
  const [range] = useState(() => {
    const day = new Date();
    day.setHours(12, 0, 0, 0);
    return { from: day, to: day };
  });
  const active = useActiveWorkout().data;
  const plans = (usePlanOccurrences(range).data ?? []).filter((p) => p.status === 'planned');
  const peopleOf = useContext(PlanSocialContext).usePlanPeople(plans);
  const [starting, setStarting] = useState(false);
  const [plan, ...morePlans] = plans;

  if (active) {
    return (
      <section className={card}>
        <span className={label}>Läuft gerade</span>
        <div className="flex items-center gap-3">
          <TrainingTypeIcon
            icon={active.trainingType.icon}
            variant="filled"
            className="size-8 shrink-0 text-accent"
          />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-title-3 font-bold">{active.trainingType.name}</span>
            <span className="text-subhead text-text-muted tabular-nums">
              {formatDuration(elapsedSeconds(active))} · {active.items.length}{' '}
              {active.items.length === 1 ? 'Übung' : 'Übungen'}
            </span>
          </span>
        </div>
        <Button size="lg" onClick={() => void navigate(paths.liveWorkout)}>
          Öffnen
        </Button>
      </section>
    );
  }

  if (plan) {
    const people = peopleOf(plan).filter((p) => p.id !== userId);
    const withText =
      people.length > 0 ? `mit ${people.map((p) => p.displayName).join(', ')}` : null;
    return (
      <section className={card}>
        <span className={label}>Heute geplant</span>
        <button
          type="button"
          onClick={() => {
            void navigate(`${paths.training}?${targetParams.plan}=${plan.planId}`);
          }}
          className="flex items-center gap-3 text-left"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-pill bg-surface-3 text-accent">
            {plan.kind === 'event' ? (
              <span aria-hidden className="text-title-3">
                ★
              </span>
            ) : (
              <TrainingTypeIcon icon={plan.trainingType?.icon ?? 'generic'} className="size-6" />
            )}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-title-3 font-bold">
              {[planTitle(plan), plan.focus?.name].filter(Boolean).join(' · ')}
            </span>
            <span className="truncate text-subhead text-text-muted">
              {[plan.startTime ? `${plan.startTime} Uhr` : null, withText]
                .filter(Boolean)
                .join(' · ') || 'Details ›'}
            </span>
          </span>
          <PlanPeopleAvatars people={people} />
        </button>
        {plan.kind === 'training' && plan.trainingType && (
          <div className="flex flex-col [&>button]:w-full">
            <PlanStartButton plan={plan} size="lg" label="Training starten" />
          </div>
        )}
        {morePlans.length > 0 && (
          <button
            type="button"
            onClick={() => void navigate(paths.training)}
            className="-mt-2 min-h-tap text-subhead font-semibold text-accent"
          >
            + {morePlans.length} {morePlans.length === 1 ? 'weiterer Termin' : 'weitere Termine'}{' '}
            heute
          </button>
        )}
      </section>
    );
  }

  return (
    <section className={card}>
      <span className={label}>Heute</span>
      <div className="flex flex-col gap-1">
        <span className="text-title-3 font-bold">Lust auf Training?</span>
        <span className="text-subhead text-text-muted">
          Starte frei oder mit einer deiner Vorlagen.
        </span>
      </div>
      <Button
        size="lg"
        onClick={() => {
          setStarting(true);
        }}
      >
        Training starten
      </Button>
      <StartTrainingSheet
        open={starting}
        onOpenChange={setStarting}
        onOpenWorkout={() => void navigate(paths.liveWorkout)}
      />
    </section>
  );
}
