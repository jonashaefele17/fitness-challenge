import { useContext, useState } from 'react';
import { useNavigate } from 'react-router';
import { useUserId } from '@/features/auth';
import {
  LiveDateButton,
  LiveDateRow,
  useLiveTodayDates,
  type LiveToday,
} from '@/features/live-training';
import {
  answerText,
  elapsedSeconds,
  formatDuration,
  LinkedPlanSheet,
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
import type { ReactNode } from 'react';
import { paths } from '../paths';

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
  const liveDates = useLiveTodayDates();
  // Who takes part: in my dates and in those of others I am invited to.
  const peopleOf = useContext(PlanSocialContext).usePlanPeople([
    ...plans,
    ...liveDates.map((d) => ({ planId: d.planId, userId: d.ownerId, planDate: d.planOn })),
  ]);
  const [starting, setStarting] = useState(false);
  const openLive = () => void navigate(paths.liveWorkout);
  // A date's detail opens right here, as a sheet (no switch to the training tab).
  const [detailId, setDetailId] = useState<string | null>(null);
  const openPlan = (plan: PlanOccurrence) => {
    setDetailId(plan.planId);
  };
  const detail = (
    <LinkedPlanSheet
      planId={detailId}
      onClose={() => {
        setDetailId(null);
      }}
    />
  );
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
          <Button onClick={openLive}>Öffnen</Button>
        </div>
        {rows}
        {detail}
      </section>
    );
  }

  if (next) {
    const ref =
      'own' in next
        ? next.own
        : { planId: next.live.planId, userId: next.live.ownerId, planDate: next.live.planOn };
    return (
      <section className={card}>
        <MainEntry
          title={
            'own' in next
              ? [planTitle(next.own), next.own.focus?.name].filter(Boolean).join(' · ')
              : [next.live.typeName, next.live.focusName].filter(Boolean).join(' · ')
          }
          time={'own' in next ? next.own.startTime : next.live.startTime}
          icon={
            'own' in next ? (
              <PlanIcon plan={next.own} className="size-6" />
            ) : (
              <TrainingTypeIcon icon={next.live.typeIcon} className="size-6" />
            )
          }
          people={peopleOf(ref)}
          userId={userId}
          onDetails={() => {
            setDetailId(ref.planId);
          }}
          action={
            'own' in next ? (
              next.own.kind === 'training' && next.own.trainingType ? (
                <PlanStartButton plan={next.own} />
              ) : null
            ) : (
              <LiveDateButton date={next.live} onStarted={openLive} />
            )
          }
        />
        {rows}
        {detail}
      </section>
    );
  }

  return (
    <section className={card}>
      <span className={label}>Heute</span>
      <div className="flex items-center gap-3">
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-title-3 font-bold">Lust auf Training?</span>
          <span className="text-subhead text-text-muted">
            Starte frei oder mit einer deiner Vorlagen.
          </span>
        </span>
        <Button
          onClick={() => {
            setStarting(true);
          }}
        >
          Starten
        </Button>
      </div>
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

/** "Grazon kommt · du hast zugesagt" – the others first, then me (unless it is my plan). */
function peopleSentence(people: PlanPerson[], userId: string): string {
  const others = people.filter((p) => p.id !== userId);
  const me = people.find((p) => p.id === userId && !p.owner);
  const parts = others.slice(0, 2).map((p) => `${p.displayName} ${answerText(p.answer)}`);
  if (others.length > 2) parts.push(`+${String(others.length - 2)}`);
  if (me) {
    parts.push(
      me.answer === 'accepted'
        ? 'du hast zugesagt'
        : me.answer === 'open'
          ? 'deine Antwort fehlt'
          : `du: ${answerText(me.answer)}`,
    );
  }
  return parts.join(' · ');
}

/**
 * The next date: label and "Details ›", title and time, then everyone taking part (with
 * their answer) and the start.
 */
function MainEntry({
  title,
  time,
  icon,
  people,
  userId,
  onDetails,
  action,
}: {
  title: string;
  time: string | null;
  icon: ReactNode;
  people: PlanPerson[];
  userId: string;
  onDetails: () => void;
  action: ReactNode;
}) {
  return (
    <>
      <div className="flex items-center justify-between">
        <span className={label}>Heute geplant</span>
        <button
          type="button"
          onClick={onDetails}
          className="-my-2 min-h-tap px-1 text-subhead font-semibold text-accent"
        >
          Details ›
        </button>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onDetails}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-pill bg-surface-3 text-accent">
            {icon}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-title-3 font-bold">{title}</span>
            <span className="truncate text-subhead text-text-muted">
              {time ? `${time} Uhr` : 'Heute'}
            </span>
          </span>
        </button>
        {people.length === 0 && action}
      </div>
      {people.length > 0 && (
        <div className="flex items-center gap-3">
          <PlanPeopleAvatars people={people} />
          <span className="min-w-0 flex-1 text-footnote text-text-muted">
            {peopleSentence(people, userId)}
          </span>
          {action}
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
