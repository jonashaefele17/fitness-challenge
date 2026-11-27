import { useState, type ReactNode } from 'react';
import { useUserId } from '@/features/auth';
import {
  WeighReminderFields,
  WeightShareChoice,
  useBodySettings,
  useSaveBodySettings,
} from '@/features/body';
import {
  FlowStepHeader,
  formatGoalPeriod,
  goalTitle,
  goalTodayKey,
  GoalCreateFlow,
  GoalDetailSheet,
  GoalValues as GoalValuesLine,
  useCreateGoal,
  useGoalMetrics,
  useGoalReferenceOptions,
  useGoals,
  useGoalStartSuggestion,
  useUpdateGoal,
  validateGoalValues,
  formatGoalValue,
  noReference,
  type Goal,
  type GoalMetric,
  type GoalReference,
} from '@/features/goals';
import { useActiveGroup, useGroupMembers } from '@/features/groups';
import { Avatar } from '@/features/profile';
import { cn, showToast } from '@/shared/lib';
import { Button, CheckIcon, ChevronRightIcon, FieldGroup, PlusIcon, Sheet } from '@/shared/ui';
import {
  useLinkSeasonGoal,
  useSeasonGoalLinks,
  useSeasonParticipants,
  useSetSeasonReady,
  useUnlinkSeasonGoal,
} from '../api/useSeasons';
import {
  missingMetricsText,
  seasonCountdownText,
  seasonErrorText,
  seasonRulesLines,
  seasonWeekText,
} from '../format';
import { canEditMySeasonGoals, canMarkReady, readyLocks } from '../season';
import {
  linkableGoals,
  myGoalIds,
  seasonGoalFrame,
  readSetupStep as readStep,
  setupDaysLeftText,
  setupSteps,
  writeSetupStep as writeStep,
  type SetupStep,
} from '../setup';
import type { Season } from '../types';
import { GoalValuesEditor, type GoalValues } from './GoalValuesEditor';

const TRAININGS = 'trainings_per_week';
const HABIT = 'habit_rate';
const DEFAULT_CHECKIN_TIME = '08:00';

/**
 * The season setup, one thing per screen: frame (read only) → training goal (required) →
 * further goals → habits → sharing the weight → rhythms (when the rules ask) → summary with
 * "Bereit". Everything is saved as it is chosen, so the flow can be closed and resumed at the
 * screen it was left on; everything stays changeable until the start (catching up after the
 * start, and as a late entrant: until "Bereit").
 */
export function SeasonSetupFlow({
  season,
  open,
  onOpenChange,
}: {
  season: Season;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const steps = setupSteps(season.rules);
  const [step, setStepState] = useState<SetupStep>('frame');
  const setStep = (next: SetupStep) => {
    setStepState(next);
    writeStep(season.id, next);
  };
  // Resume where I left off each time it opens (state adjusted while rendering).
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      const remembered = readStep(season.id);
      setStepState(remembered && steps.includes(remembered) ? remembered : 'frame');
    }
  }
  const index = Math.max(0, steps.indexOf(step));
  const counted = steps.filter((s) => s !== 'summary');
  const header = (
    <FlowStepHeader
      onBack={
        index > 0
          ? () => {
              setStep(steps[index - 1] ?? 'frame');
            }
          : undefined
      }
      counter={
        step === 'summary'
          ? null
          : `${String(counted.indexOf(step) + 1)} von ${String(counted.length)}`
      }
    />
  );
  const next = () => {
    setStep(steps[index + 1] ?? 'summary');
  };
  const editable = canEditMySeasonGoals(season);

  let content: ReactNode;
  if (step === 'frame') content = <FrameStep season={season} header={header} onNext={next} />;
  else if (step === 'training')
    content = <TrainingStep season={season} header={header} onNext={next} editable={editable} />;
  else if (step === 'extra')
    content = <ExtraStep season={season} header={header} onNext={next} editable={editable} />;
  else if (step === 'habits')
    content = <HabitsStep season={season} header={header} onNext={next} editable={editable} />;
  else if (step === 'share') content = <ShareStep header={header} onNext={next} />;
  else if (step === 'rhythms')
    content = <RhythmsStep season={season} header={header} onNext={next} />;
  else
    content = (
      <SummaryStep
        season={season}
        header={header}
        onEdit={setStep}
        onDone={() => {
          onOpenChange(false);
        }}
      />
    );

  return (
    <Sheet
      fullHeight
      open={open}
      onOpenChange={onOpenChange}
      title="Saison einrichten"
      className="min-h-sheet-min"
    >
      {content}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function Screen({
  header,
  title,
  hint,
  children,
  footer,
}: {
  header: ReactNode;
  title: string;
  hint?: string | undefined;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-sheet-min flex-col gap-5 pt-1">
      <div className="flex flex-col gap-1">
        {header}
        <h3 className="text-title-2 font-bold">{title}</h3>
        {hint && <p className="text-subhead text-text-muted">{hint}</p>}
      </div>
      {children}
      {footer && <div className="mt-auto flex flex-col gap-2 pb-2">{footer}</div>}
    </div>
  );
}

function NextButton({ onNext, label = 'Weiter' }: { onNext: () => void; label?: string }) {
  return (
    <Button size="lg" onClick={onNext}>
      {label}
    </Button>
  );
}

/**
 * My goals in the season, the metric catalogue and the writes that keep them linked. The
 * writes use promises, not mutate callbacks: a screen is often gone (next step) before the
 * database answers, and linking after creating must still happen.
 */
function useMySeasonGoals(season: Season) {
  const userId = useUserId();
  const links = useSeasonGoalLinks(season.id).data ?? [];
  const goals = useGoals().data ?? [];
  const metrics = useGoalMetrics().data ?? [];
  const ids = myGoalIds(links, userId);
  const linked = goals.filter((g) => ids.has(g.id));
  const create = useCreateGoal();
  const update = useUpdateGoal();
  const link = useLinkSeasonGoal();
  const unlink = useUnlinkSeasonGoal();
  const startsOn = season.me?.startsOn ?? season.startsOn;

  const refused = (fallback: string) => (error: unknown) => {
    showToast(seasonErrorText(error) ?? fallback);
  };
  /** Resolves to whether it worked. */
  const linkGoal = (goal: Pick<Goal, 'id' | 'metric'>) =>
    link.mutateAsync({ seasonId: season.id, goal }).then(
      () => true,
      (error: unknown) => {
        refused('Ziel konnte nicht in die Saison übernommen werden.')(error);
        return false;
      },
    );

  /**
   * New target and minimum of a season goal (before the start: for its whole period). The
   * period and visibility are the season's.
   */
  function updateValues(goal: Goal, values: GoalValues) {
    if (values.target === null) return;
    if (values.target === goal.targetValue && values.min === goal.minValue) return;
    update
      .mutateAsync({
        goalId: goal.id,
        startsOn,
        endsOn: season.endsOn,
        startValue: goal.startValue,
        minValue: values.min,
        targetValue: values.target,
        visibility: 'shared',
        // Not locked yet: the values hold for the whole season (one version from my start).
        validFrom: startsOn,
      })
      .catch(refused('Änderung konnte nicht gespeichert werden.'));
  }

  return {
    goals,
    linked,
    ids,
    metrics,
    startsOn,
    /** A new goal for the season (shared, season period), linked once it is saved. */
    createLinked(
      metric: GoalMetric,
      reference: GoalReference,
      values: GoalValues,
      label: string | null,
    ) {
      if (values.target === null) return;
      const id = crypto.randomUUID();
      create
        .mutateAsync({
          input: {
            id,
            metric: metric.key,
            reference,
            reps: null,
            startsOn,
            endsOn: season.endsOn,
            startValue: values.start,
            minValue: values.min,
            targetValue: values.target,
            visibility: 'shared',
          },
          display: {
            metric,
            unit: metric.unit ?? 'percent',
            referenceLabel: label,
            referenceDetail: null,
          },
        })
        .then(
          () => linkGoal({ id, metric: metric.key }),
          refused('Ziel konnte nicht gespeichert werden.'),
        );
    },
    updateValues,
    /** One of my goals into the season, then with these values. */
    adopt(goal: Goal, values: GoalValues) {
      void linkGoal(goal).then((linked) => {
        if (linked) updateValues(goal, values);
      });
    },
    link(goal: Pick<Goal, 'id' | 'metric'>) {
      void linkGoal(goal);
    },
    unlink(goal: Goal) {
      unlink
        .mutateAsync({ seasonId: season.id, goalId: goal.id })
        .catch(refused('Ziel konnte nicht aus der Saison genommen werden.'));
      showToast('Aus der Saison genommen', {
        label: 'Rückgängig',
        onAction: () => {
          void linkGoal(goal);
        },
      });
    },
  };
}

function LockedNote({ editable }: { editable: boolean }) {
  if (editable) return null;
  return (
    <p className="text-footnote text-text-muted">
      Deine Saisonziele sind festgeschrieben. Änderungen nur durch den Admin.
    </p>
  );
}

// ---------------------------------------------------------------------------
// 1 Rahmen
// ---------------------------------------------------------------------------

function FrameStep({
  season,
  header,
  onNext,
}: {
  season: Season;
  header: ReactNode;
  onNext: () => void;
}) {
  const [today] = useState(goalTodayKey);
  const { group } = useActiveGroup();
  const participants = useSeasonParticipants(season.id).data ?? [];
  const members = (useGroupMembers(group.id).data ?? []).filter((m) =>
    participants.some((p) => p.userId === m.userId),
  );
  const metrics = useGoalMetrics().data ?? [];
  const label = (key: string) => metrics.find((m) => m.key === key)?.label ?? key;
  const rules = seasonRulesLines(season.rules, label);
  return (
    <Screen
      header={header}
      title={season.name}
      hint={`${formatGoalPeriod(season.startsOn, season.endsOn, today)} · ${seasonWeekText(season)}`}
      footer={<NextButton onNext={onNext} />}
    >
      <ul className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
        <li className="flex min-h-tap items-center px-4 py-2 text-body">
          {seasonCountdownText(season)}
        </li>
        {season.me?.lateEntry && (
          <Row
            label="Deine Ziele ab"
            value={formatGoalPeriod(season.me.startsOn, season.endsOn, today)}
          />
        )}
        {rules.map((line) => (
          <li key={line} className="flex min-h-tap items-center px-4 py-2 text-body">
            {line}
          </li>
        ))}
      </ul>
      <FieldGroup label={`Dabei (${String(season.participantCount)})`}>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <span
              key={m.userId}
              className="flex items-center gap-2 rounded-pill bg-surface-2 py-1 pr-3 pl-1"
            >
              <Avatar profile={m} size="sm" />
              <span className="text-subhead">{m.displayName}</span>
            </span>
          ))}
        </div>
      </FieldGroup>
      <p className="text-footnote text-text-muted">
        {readyLocks(season)
          ? `${season.me?.lateEntry ? '' : 'Die Saison läuft schon – deine Ziele gelten trotzdem ab dem Saisonstart. '}Alles hier wird sofort gespeichert. Du kannst jederzeit aufhören und später weitermachen – bis du auf „Bereit“ tippst, bleibt alles änderbar. Pflicht ist nur das Trainingsziel.`
          : 'Alles hier wird sofort gespeichert. Du kannst jederzeit aufhören und später weitermachen – bis zum Start bleibt alles änderbar. Pflicht ist nur das Trainingsziel.'}
      </p>
    </Screen>
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

// ---------------------------------------------------------------------------
// 2 Trainingsziel
// ---------------------------------------------------------------------------

function TrainingStep({
  season,
  header,
  onNext,
  editable,
}: {
  season: Season;
  header: ReactNode;
  onNext: () => void;
  editable: boolean;
}) {
  const mine = useMySeasonGoals(season);
  const metric = mine.metrics.find((m) => m.key === TRAININGS) ?? null;
  const goal = mine.linked.find((g) => g.metric === TRAININGS) ?? null;
  const existing =
    goal === null
      ? (mine.goals.find(
          (g) => g.metric === TRAININGS && g.archivedAt === null && g.phase !== 'ended',
        ) ?? null)
      : null;
  const baseline = useGoalStartSuggestion({ metric: TRAININGS }).data?.value ?? null;
  const [values, setValues] = useState<GoalValues | null>(null);
  // A running trainings goal of mine is taken over (it then runs over the season).
  const source = goal ?? existing;
  const shown: GoalValues = values ?? {
    start: null,
    target: source?.targetValue ?? null,
    min: source?.minValue ?? null,
  };
  const error = validateGoalValues(
    { key: TRAININGS, kind: 'rate' },
    { startValue: null, minValue: shown.min, targetValue: shown.target },
  );

  function save() {
    if (!editable) {
      onNext();
      return;
    }
    if (goal) mine.updateValues(goal, shown);
    else if (existing) mine.adopt(existing, shown);
    else if (metric) mine.createLinked(metric, noReference, { ...shown, start: baseline }, null);
    onNext();
  }

  return (
    <Screen
      header={header}
      title="Trainings pro Woche"
      hint={`Das Pflicht-Ziel der Saison. Ein Tag mit Training zählt einmal. ${
        baseline === null
          ? ''
          : `In den letzten 4 Wochen: Ø ${formatGoalValue(baseline, 'per_week')}.`
      }`}
      footer={
        editable ? (
          <Button size="lg" missing={error} onClick={save}>
            Weiter
          </Button>
        ) : (
          <NextButton onNext={onNext} />
        )
      }
    >
      <LockedNote editable={editable} />
      {existing && editable && (
        <p className="text-footnote text-text-muted">
          Dein laufendes Trainingsziel wird zum Saisonziel – es läuft dann über die Saison.
        </p>
      )}
      {editable ? (
        <GoalValuesEditor
          metric={TRAININGS}
          kind="rate"
          unit="per_week"
          values={shown}
          onChange={setValues}
        />
      ) : (
        goal && <GoalValuesLine goal={goal} />
      )}
      <p className="text-footnote text-text-muted">
        Das Mindestziel ist, worauf du dich festlegst – das Ziel, was du erreichen willst. Eine
        Woche zählt höchstens bis zum Ziel; Pausen machen die Woche kleiner.
      </p>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// 3 Weitere Ziele
// ---------------------------------------------------------------------------

function ExtraStep({
  season,
  header,
  onNext,
  editable,
}: {
  season: Season;
  header: ReactNode;
  onNext: () => void;
  editable: boolean;
}) {
  const mine = useMySeasonGoals(season);
  const extra = mine.linked.filter((g) => g.metric !== TRAININGS && g.metric !== HABIT);
  const offered = mine.metrics.filter((m) => m.key !== TRAININGS && m.key !== HABIT);
  const linkable = linkableGoals(mine.goals, mine.ids);
  const [creating, setCreating] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [shownId, setShownId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const shown = mine.goals.find((g) => g.id === shownId) ?? null;

  return (
    <Screen
      header={header}
      title="Weitere Ziele"
      hint="Freiwillig: Gewicht, ein Bestwert oder ein Körpermaß – gezählt ab dem Saisonstart, sichtbar für die Gruppe."
      footer={<NextButton onNext={onNext} />}
    >
      <LockedNote editable={editable} />
      {extra.length > 0 && (
        <ul className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
          {extra.map((goal) => (
            <li key={goal.id}>
              <button
                type="button"
                onClick={() => {
                  setShownId(goal.id);
                  setDetailOpen(true);
                }}
                className="flex min-h-tap w-full items-center gap-3 px-4 py-2.5 text-left active:bg-surface-3"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body">{goalTitle(goal)}</span>
                  <GoalValuesLine goal={goal} className="text-footnote" />
                </span>
                <ChevronRightIcon aria-hidden className="shrink-0 text-text-subtle" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <FieldGroup label="Ziel hinzufügen">
          <ul className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
            {offered.map((m) => (
              <li key={m.key}>
                <button
                  type="button"
                  onClick={() => {
                    setCreating(m.key);
                    setCreateOpen(true);
                  }}
                  className="flex min-h-tap w-full items-center gap-3 px-4 py-2.5 text-left active:bg-surface-3"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-body">{m.label}</span>
                    <span className="text-footnote text-text-muted">{m.description}</span>
                  </span>
                  <PlusIcon aria-hidden className="shrink-0 text-accent" />
                </button>
              </li>
            ))}
          </ul>
        </FieldGroup>
      )}
      {editable && linkable.length > 0 && (
        <FieldGroup label="Vorhandenes Ziel übernehmen">
          <ul className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
            {linkable.map((goal) => (
              <li key={goal.id}>
                <button
                  type="button"
                  onClick={() => {
                    mine.link(goal);
                  }}
                  className="flex min-h-tap w-full items-center gap-3 px-4 py-2.5 text-left active:bg-surface-3"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-body">{goalTitle(goal)}</span>
                    <span className="text-footnote text-text-muted">
                      Läuft dann über die Saison und ist für die Gruppe sichtbar.
                    </span>
                  </span>
                  <PlusIcon aria-hidden className="shrink-0 text-accent" />
                </button>
              </li>
            ))}
          </ul>
        </FieldGroup>
      )}

      <GoalCreateFlow
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Saisonziel"
        preset={
          creating
            ? {
                metric: creating,
                startsOn: mine.startsOn,
                endsOn: season.endsOn,
                visibility: 'shared',
              }
            : null
        }
        onCreated={(id) => {
          const metric = creating ?? '';
          mine.link({ id, metric });
        }}
      />
      <GoalDetailSheet
        goal={shown}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        frame={seasonGoalFrame(season)}
        footer={
          shown && editable ? (
            <Button
              variant="danger"
              fullWidth
              onClick={() => {
                setDetailOpen(false);
                mine.unlink(shown);
              }}
            >
              Aus der Saison nehmen
            </Button>
          ) : null
        }
      />
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// 4 Habits
// ---------------------------------------------------------------------------

function HabitsStep({
  season,
  header,
  onNext,
  editable,
}: {
  season: Season;
  header: ReactNode;
  onNext: () => void;
  editable: boolean;
}) {
  const mine = useMySeasonGoals(season);
  const options = useGoalReferenceOptions(HABIT);
  const metric = mine.metrics.find((m) => m.key === HABIT) ?? null;
  const [picked, setPicked] = useState<{ habitId: string; label: string } | null>(null);
  const [open, setOpen] = useState(false);
  const goalOf = (habitId: string, linkedOnly: boolean) =>
    (linkedOnly ? mine.linked : mine.goals).find(
      (g) =>
        g.metric === HABIT &&
        g.reference.habitId === habitId &&
        g.archivedAt === null &&
        g.phase !== 'ended',
    ) ?? null;
  const list = options.data ?? [];

  return (
    <Screen
      header={header}
      title="Habits"
      hint="Welche deiner Habits zählen in der Saison? Für jedes eine Quote: an wie viel Prozent der Tage du es schaffen willst."
      footer={<NextButton onNext={onNext} />}
    >
      <LockedNote editable={editable} />
      {options.isPending ? null : list.length === 0 ? (
        <p className="py-4 text-center text-subhead text-text-subtle">Noch kein Habit.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
          {list.map((o) => {
            const habitId = o.reference.habitId ?? '';
            const goal = goalOf(habitId, true);
            return (
              <li key={habitId}>
                <button
                  type="button"
                  disabled={!editable}
                  onClick={() => {
                    setPicked({ habitId, label: o.label });
                    setOpen(true);
                  }}
                  aria-pressed={goal !== null}
                  className="flex min-h-tap w-full items-center gap-3 px-4 py-2.5 text-left active:bg-surface-3 disabled:active:bg-transparent"
                >
                  <span
                    aria-hidden
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-pill border',
                      goal ? 'border-accent bg-accent text-on-accent' : 'border-text-subtle',
                    )}
                  >
                    {goal && <CheckIcon className="size-4" strokeWidth={3} />}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-body">{o.label}</span>
                    {goal && <GoalValuesLine goal={goal} className="text-footnote" />}
                  </span>
                  {editable && (
                    <ChevronRightIcon aria-hidden className="shrink-0 text-text-subtle" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-footnote text-text-muted">
        Ein neues Habit legst du unter Ich → Habits an; danach steht es hier.
      </p>
      {picked && metric && (
        <HabitQuotaSheet
          open={open}
          onOpenChange={setOpen}
          label={picked.label}
          habitId={picked.habitId}
          linked={goalOf(picked.habitId, true)}
          existing={goalOf(picked.habitId, false)}
          onSave={(values, linked, existing) => {
            setOpen(false);
            if (linked) mine.updateValues(linked, values);
            else if (existing) mine.adopt(existing, values);
            else {
              mine.createLinked(
                metric,
                { ...noReference, habitId: picked.habitId },
                values,
                picked.label,
              );
            }
          }}
          onRemove={(goal) => {
            setOpen(false);
            mine.unlink(goal);
          }}
        />
      )}
    </Screen>
  );
}

function HabitQuotaSheet({
  open,
  onOpenChange,
  label,
  habitId,
  linked,
  existing,
  onSave,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  habitId: string;
  linked: Goal | null;
  existing: Goal | null;
  onSave: (values: GoalValues, linked: Goal | null, existing: Goal | null) => void;
  onRemove: (goal: Goal) => void;
}) {
  const baseline =
    useGoalStartSuggestion(open ? { metric: HABIT, reference: { habitId } } : null).data?.value ??
    null;
  const source = linked ?? existing;
  const [values, setValues] = useState<GoalValues>({ start: null, target: null, min: null });
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setValues({
        start: null,
        target: source?.targetValue ?? null,
        min: source?.minValue ?? null,
      });
    }
  }
  const error = validateGoalValues(
    { key: HABIT, kind: 'rate' },
    { startValue: null, minValue: values.min, targetValue: values.target },
  );
  return (
    <Sheet
      fullHeight
      open={open}
      onOpenChange={onOpenChange}
      title={label}
      footer={
        <div className="flex flex-col gap-2">
          <Button
            size="lg"
            fullWidth
            missing={error}
            onClick={() => {
              onSave({ ...values, start: baseline }, linked, existing);
            }}
          >
            {linked ? 'Speichern' : 'In die Saison'}
          </Button>
          {linked && (
            <Button
              variant="ghost"
              fullWidth
              onClick={() => {
                onRemove(linked);
              }}
            >
              Nicht in der Saison
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-4 pt-1">
        <p className="text-subhead text-text-muted">
          {baseline === null
            ? 'In den letzten 4 Wochen gab es noch nichts zu zählen.'
            : `In den letzten 4 Wochen: ${formatGoalValue(baseline, 'percent')}.`}
        </p>
        <GoalValuesEditor
          metric={HABIT}
          kind="rate"
          unit="percent"
          values={values}
          onChange={setValues}
        />
        <p className="text-footnote text-text-muted">
          Die Gruppe sieht den Namen des Habits und deine Quote – auch wenn das Habit selbst privat
          ist.
        </p>
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// 5 Gewicht teilen
// ---------------------------------------------------------------------------

function ShareStep({ header, onNext }: { header: ReactNode; onNext: () => void }) {
  return (
    <Screen
      header={header}
      title="Gewicht teilen?"
      hint="Die Saison verlangt es nicht. Wer nicht teilt, fehlt im Gewichtsvergleich – ein Gewichtsziel zeigt der Gruppe trotzdem den Fortschritt in %."
      footer={<NextButton onNext={onNext} />}
    >
      <WeightShareChoice />
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// 6 Rhythmen
// ---------------------------------------------------------------------------

function RhythmsStep({
  season,
  header,
  onNext,
}: {
  season: Season;
  header: ReactNode;
  onNext: () => void;
}) {
  const settings = useBodySettings().data;
  const save = useSaveBodySettings();
  const every = season.rules.checkinEveryWeeks;
  const rhythmSet = settings?.checkinEveryWeeks === every;
  const time = settings?.checkinReminderAt ?? DEFAULT_CHECKIN_TIME;

  function applyRhythm(at: string) {
    if (every === null) return;
    save.mutate(
      { checkinEveryWeeks: every, checkinReminderAt: at },
      {
        onError: () => {
          showToast('Rhythmus konnte nicht gespeichert werden.');
        },
      },
    );
  }

  return (
    <Screen
      header={header}
      title="Rhythmen"
      hint="Die Saison gibt vor, wie oft; Wochentag und Uhrzeit wählst du selbst."
      footer={
        <NextButton
          onNext={() => {
            if (every !== null && !rhythmSet) applyRhythm(time);
            onNext();
          }}
        />
      }
    >
      {season.rules.weighWeekly && (
        <FieldGroup label="Wiegen · jede Woche">
          <div className="flex flex-col gap-3">
            <WeighReminderFields />
            {settings && settings.weighReminderDays.length === 0 && (
              <p className="text-footnote text-text-muted">
                Wähl mindestens einen Tag – an dem erinnert dich die App.
              </p>
            )}
          </div>
        </FieldGroup>
      )}
      {every !== null && (
        <FieldGroup label={`Zwischenstand · alle ${String(every)} Wochen`}>
          <div className="flex min-h-tap items-center justify-between gap-3 rounded-card bg-surface-2 px-4 py-2">
            <span className="text-body">Erinnerung um</span>
            <input
              type="time"
              aria-label="Uhrzeit der Zwischenstand-Erinnerung"
              value={time}
              onChange={(event) => {
                if (event.target.value) applyRhythm(event.target.value);
              }}
              className="h-tap rounded-sm bg-surface-3 px-2 text-subhead tabular-nums"
            />
          </div>
          <p className="text-footnote text-text-muted">
            {rhythmSet
              ? 'Dein Rhythmus passt zur Saison.'
              : `Mit „Weiter“ stellt die App deinen Zwischenstand auf alle ${String(every)} Wochen.`}
          </p>
        </FieldGroup>
      )}
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// 7 Zusammenfassung
// ---------------------------------------------------------------------------

function SummaryStep({
  season,
  header,
  onEdit,
  onDone,
}: {
  season: Season;
  header: ReactNode;
  onEdit: (step: SetupStep) => void;
  onDone: () => void;
}) {
  const mine = useMySeasonGoals(season);
  const ready = useSetSeasonReady();
  const label = (key: string) => mine.metrics.find((m) => m.key === key)?.label ?? key;
  const missing = season.me ? missingMetricsText(season.me.missingMetrics, label) : null;
  const isReady = season.me?.readyAt != null;
  const editable = canEditMySeasonGoals(season);
  // Late entrants and those catching up: "Bereit" locks the goals at once (no undo).
  const locksNow = readyLocks(season);

  function setReady(value: boolean) {
    // A promise: the flow closes right away, the answer still has to reach the toast.
    ready.mutateAsync({ seasonId: season.id, ready: value }).catch((error: unknown) => {
      showToast(seasonErrorText(error) ?? 'Konnte nicht gespeichert werden.');
    });
  }

  return (
    <Screen
      header={header}
      title="Übersicht"
      hint={editable ? setupDaysLeftText(season) : undefined}
      footer={
        editable ? (
          isReady ? (
            <>
              <p className="flex items-center justify-center gap-1.5 text-subhead">
                <CheckIcon aria-hidden className="text-accent" /> Du bist bereit
              </p>
              <Button
                variant="ghost"
                onClick={() => {
                  setReady(false);
                }}
              >
                Doch nicht bereit
              </Button>
            </>
          ) : (
            <>
              {locksNow && (
                <p className="text-center text-footnote text-text-muted">
                  {season.me?.lateEntry
                    ? 'Mit „Bereit“ werden deine Ziele festgeschrieben.'
                    : 'Die Saison läuft schon: Mit „Bereit“ werden deine Ziele sofort festgeschrieben.'}
                </p>
              )}
              <Button
                size="lg"
                missing={canMarkReady(season) ? null : (missing ?? 'Gerade nicht möglich.')}
                onClick={() => {
                  setReady(true);
                  onDone();
                  showToast(
                    `Bereit für „${season.name}“`,
                    locksNow
                      ? undefined
                      : {
                          label: 'Rückgängig',
                          onAction: () => {
                            setReady(false);
                          },
                        },
                  );
                }}
              >
                Bereit
              </Button>
            </>
          )
        ) : (
          <NextButton onNext={onDone} label="Fertig" />
        )
      }
    >
      {mine.linked.length === 0 ? (
        <p className="text-subhead text-text-muted">Noch keine Saisonziele.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
          {mine.linked.map((goal) => (
            <li key={goal.id}>
              <button
                type="button"
                onClick={() => {
                  onEdit(
                    goal.metric === TRAININGS
                      ? 'training'
                      : goal.metric === HABIT
                        ? 'habits'
                        : 'extra',
                  );
                }}
                className="flex min-h-tap w-full items-center gap-3 px-4 py-2.5 text-left active:bg-surface-3"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body">{goalTitle(goal)}</span>
                  <GoalValuesLine goal={goal} className="text-footnote" />
                </span>
                <ChevronRightIcon aria-hidden className="shrink-0 text-text-subtle" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {missing && <p className="text-footnote text-danger">{missing}</p>}
      {!locksNow && editable && (
        <p className="text-footnote text-text-muted">
          Bis zum Start kannst du alles noch ändern. Am Start werden die Ziele festgeschrieben.
        </p>
      )}
    </Screen>
  );
}
