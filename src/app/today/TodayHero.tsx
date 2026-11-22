import { useContext, useState } from 'react';
import { useNavigate } from 'react-router';
import { useUserId } from '@/features/auth';
import {
  LiveDateMain,
  LiveDateRow,
  useLiveTodayDates,
  type LiveToday,
} from '@/features/live-training';
import {
  elapsedSeconds,
  formatDuration,
  planTitle,
  PlanPeopleAvatars,
  PlanSocialContext,
  PlanStartButton,
  StartTrainingSheet,
  TrainingTypeIcon,
  useActiveWorkout,
  usePlanOccurrences,
  type PlanOccurrence,
  type PlanPerson,
} from '@/features/training';
import { Button } from '@/shared/ui';
import { paths } from '../paths';
import { targetParams } from '../targets';

const card = 'flex flex-col gap-4 rounded-card border border-accent/40 bg-surface-2 p-4';
const label = 'text-footnote font-semibold text-accent';

/** Today's dates in one list: mine and those of others I take part in, by time. */
type Entry =
  | { key: string; time: string | null; own: PlanOccurrence }
  | { key: string; time: string | null; live: LiveToday };

/**
 * The one big card on Heute, always what matters now: a running training, else today's
 * dates (mine and those I am invited to, by time: the next one big with start, the others
 * as rows), else an invitation to train.
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
  const liveDates = useLiveTodayDates();
  const [starting, setStarting] = useState(false);
  const openLive = () => void navigate(paths.liveWorkout);
  const openPlan = (plan: PlanOccurrence) => {
    void navigate(`${paths.training}?${targetParams.plan}=${plan.planId}`);
  };
  const withOthers = (plan: PlanOccurrence) => peopleOf(plan).filter((p) => p.id !== userId);

  const entries: Entry[] = [
    ...plans.map((own) => ({ key: `own:${own.planId}`, time: own.startTime, own })),
    ...liveDates.map((live) => ({ key: `live:${live.planId}`, time: live.startTime, live })),
  ]
    // The date running right now is shown as the running training.
    .filter((e) =>
      'own' in e
        ? !(active?.plan?.id === e.own.planId && active.plan.onDate === e.own.planDate)
        : !(active && e.live.myWorkoutId === active.id),
    )
    .sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'));
  const [next, ...later] = entries;
  const rest = active ? entries : later;

  const rows =
    rest.length > 0 ? (
      <ul className="flex flex-col gap-2 border-t border-border pt-3">
        {rest.map((e) => (
          <li key={e.key}>
            {'own' in e ? (
              <PlanRow plan={e.own} people={withOthers(e.own)} onOpen={openPlan} />
            ) : (
              <LiveDateRow date={e.live} onStarted={openLive} />
            )}
          </li>
        ))}
      </ul>
    ) : null;

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
        <Button size="lg" onClick={openLive}>
          Öffnen
        </Button>
        {rows}
      </section>
    );
  }

  if (next) {
    return (
      <section className={card}>
        <span className={label}>Heute geplant</span>
        {'own' in next ? (
          <PlanMain plan={next.own} people={withOthers(next.own)} onOpen={openPlan} />
        ) : (
          <LiveDateMain date={next.live} onStarted={openLive} />
        )}
        {rows}
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
      <StartTrainingSheet open={starting} onOpenChange={setStarting} onOpenWorkout={openLive} />
    </section>
  );
}

function subtitle(plan: PlanOccurrence, people: PlanPerson[]): string {
  return [
    plan.startTime ? `${plan.startTime} Uhr` : null,
    people.length > 0 ? `mit ${people.map((p) => p.displayName).join(', ')}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function PlanIcon({ plan, className }: { plan: PlanOccurrence; className: string }) {
  return plan.kind === 'event' ? (
    <span aria-hidden>★</span>
  ) : (
    <TrainingTypeIcon icon={plan.trainingType?.icon ?? 'generic'} className={className} />
  );
}

/** My next date: big title, with whom, start. */
function PlanMain({
  plan,
  people,
  onOpen,
}: {
  plan: PlanOccurrence;
  people: PlanPerson[];
  onOpen: (plan: PlanOccurrence) => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={() => {
          onOpen(plan);
        }}
        className="flex items-center gap-3 text-left"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-pill bg-surface-3 text-accent">
          <PlanIcon plan={plan} className="size-6" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-title-3 font-bold">
            {[planTitle(plan), plan.focus?.name].filter(Boolean).join(' · ')}
          </span>
          <span className="truncate text-subhead text-text-muted">
            {subtitle(plan, people) || 'Details ›'}
          </span>
        </span>
        <PlanPeopleAvatars people={people} />
      </button>
      {plan.kind === 'training' && plan.trainingType && (
        <div className="flex flex-col [&>button]:w-full">
          <PlanStartButton plan={plan} size="lg" label="Training starten" />
        </div>
      )}
    </>
  );
}

/** A further date of mine today: one compact row with its own start. */
function PlanRow({
  plan,
  people,
  onOpen,
}: {
  plan: PlanOccurrence;
  people: PlanPerson[];
  onOpen: (plan: PlanOccurrence) => void;
}) {
  return (
    <div className="flex min-h-tap items-center gap-3">
      <button
        type="button"
        onClick={() => {
          onOpen(plan);
        }}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-surface-3 text-accent">
          <PlanIcon plan={plan} className="size-5" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-subhead font-semibold">
            {[planTitle(plan), plan.focus?.name].filter(Boolean).join(' · ')}
          </span>
          <span className="truncate text-footnote text-text-muted">{subtitle(plan, people)}</span>
        </span>
      </button>
      {plan.kind === 'training' && plan.trainingType && (
        <PlanStartButton plan={plan} variant="tinted" />
      )}
    </div>
  );
}
