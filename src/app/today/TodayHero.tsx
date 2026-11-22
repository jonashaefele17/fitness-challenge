import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useContext, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useUserId } from '@/features/auth';
import { LiveDateButton, useLiveTodayDates } from '@/features/live-training';
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
import { spring } from '@/shared/design-tokens';
import { cn } from '@/shared/lib';
import { Button } from '@/shared/ui';
import { paths } from '../paths';

const card = 'flex flex-col gap-4 rounded-card border border-accent/40 bg-surface-2 p-4';
const label = 'text-footnote font-semibold text-accent';

/** One of today's dates, mine or someone else's I take part in, ready to show. */
interface DateView {
  key: string;
  planId: string;
  title: string;
  time: string | null;
  icon: (className: string) => ReactNode;
  people: PlanPerson[];
  /** Start (or join, open) – green when open, quiet in a closed row. */
  action: (variant: 'primary' | 'tinted') => ReactNode;
}

/**
 * The one big card on Heute, always what matters now: a running training, else today's
 * dates (mine and those I am invited to, by time), else an invitation to train.
 * The dates are an accordion: one is open (everyone taking part, start, "Details ›"); a tap
 * on a closed one opens it and closes the other. Each keeps its own start button.
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
  const liveRefs = liveDates.map((d) => ({
    planId: d.planId,
    userId: d.ownerId,
    planDate: d.planOn,
  }));
  // Who takes part: in my dates and in those of others I am invited to.
  const peopleOf = useContext(PlanSocialContext).usePlanPeople([...plans, ...liveRefs]);
  const [starting, setStarting] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);
  // A date's detail opens right here, as a sheet (no switch to the training tab).
  const [detailId, setDetailId] = useState<string | null>(null);
  const openLive = () => void navigate(paths.liveWorkout);

  const views: DateView[] = [
    ...plans
      // The date running right now is shown as the running training.
      .filter((p) => !(active?.plan?.id === p.planId && active.plan.onDate === p.planDate))
      .map((plan): DateView => ({
        key: `own:${plan.planId}`,
        planId: plan.planId,
        title: [planTitle(plan), plan.focus?.name].filter(Boolean).join(' · '),
        time: plan.startTime,
        icon: (className) => <PlanIcon plan={plan} className={className} />,
        people: peopleOf(plan),
        action: (variant) =>
          plan.kind === 'training' && plan.trainingType ? (
            <PlanStartButton plan={plan} variant={variant} />
          ) : null,
      })),
    ...liveDates
      .filter((d) => !(active && d.myWorkoutId === active.id))
      .map((date, index): DateView => ({
        key: `live:${date.planId}`,
        planId: date.planId,
        title: [date.typeName, date.focusName].filter(Boolean).join(' · '),
        time: date.startTime,
        icon: (className) => <TrainingTypeIcon icon={date.typeIcon} className={className} />,
        people: liveRefs[index] ? peopleOf(liveRefs[index]) : [],
        action: (variant) => <LiveDateButton date={date} onStarted={openLive} variant={variant} />,
      })),
  ].sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'));

  // Open: the one tapped, else (nothing running) the next date.
  const openOne = views.some((v) => v.key === openKey)
    ? openKey
    : active
      ? null
      : (views[0]?.key ?? null);

  const detail = (
    <LinkedPlanSheet
      planId={detailId}
      onClose={() => {
        setDetailId(null);
      }}
    />
  );
  const dates =
    views.length > 0 ? (
      <ul className={cn('flex flex-col', active && 'border-t border-border pt-1')}>
        {views.map((view, index) => (
          <DateEntry
            key={view.key}
            view={view}
            open={view.key === openOne}
            first={index === 0}
            userId={userId}
            onOpen={() => {
              setOpenKey(view.key);
            }}
            onDetails={() => {
              setDetailId(view.planId);
            }}
          />
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
        {dates}
        {detail}
      </section>
    );
  }

  if (dates) {
    return (
      <section className={cn(card, 'gap-1')}>
        <span className={label}>Heute geplant</span>
        {dates}
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

/** Closed: "18:00 Uhr · mit Grazon". */
function closedLine(view: DateView, userId: string): string {
  const others = view.people.filter((p) => p.id !== userId);
  return [
    view.time ? `${view.time} Uhr` : 'Heute',
    others.length > 0 ? `mit ${others.map((p) => p.displayName).join(', ')}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * One date in the accordion. Closed: a compact row (tap opens it; its start works as it
 * is). Open: big title with "Details ›", everyone taking part, and the green start.
 */
function DateEntry({
  view,
  open,
  first,
  userId,
  onOpen,
  onDetails,
}: {
  view: DateView;
  open: boolean;
  first: boolean;
  userId: string;
  onOpen: () => void;
  onDetails: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion ? { duration: 0 } : spring.snappy;
  return (
    <motion.li
      layout={!reduceMotion}
      transition={transition}
      className={cn('flex flex-col', !first && 'border-t border-border')}
    >
      <div className="flex items-center gap-3 py-3">
        <button
          type="button"
          aria-expanded={open}
          onClick={open ? onDetails : onOpen}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span
            className={cn(
              'flex shrink-0 items-center justify-center rounded-pill bg-surface-3 text-accent',
              open ? 'size-12' : 'size-9',
            )}
          >
            {view.icon(open ? 'size-6' : 'size-5')}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span
              className={cn(
                'truncate font-bold',
                open ? 'text-title-3' : 'text-subhead font-semibold',
              )}
            >
              {view.title}
            </span>
            <span
              className={cn('truncate text-text-muted', open ? 'text-subhead' : 'text-footnote')}
            >
              {open ? (view.time ? `${view.time} Uhr` : 'Heute') : closedLine(view, userId)}
            </span>
          </span>
        </button>
        {open ? (
          <button
            type="button"
            onClick={onDetails}
            className="min-h-tap shrink-0 self-start px-1 text-subhead font-semibold text-accent"
          >
            Details ›
          </button>
        ) : (
          view.action('tinted')
        )}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="open"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={transition}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 pb-3">
              {view.people.length > 0 ? (
                <>
                  <PlanPeopleAvatars people={view.people} />
                  <span className="min-w-0 flex-1 text-footnote text-text-muted">
                    {peopleSentence(view.people, userId)}
                  </span>
                </>
              ) : (
                <span className="flex-1 text-footnote text-text-muted">Nur du</span>
              )}
              {view.action('primary')}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}
