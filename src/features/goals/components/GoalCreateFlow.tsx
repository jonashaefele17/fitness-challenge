import { useState, type ReactNode } from 'react';
import { showToast } from '@/shared/lib';
import { Button, CheckIcon, ChevronRightIcon, Chip, NumberWheel, Sheet } from '@/shared/ui';
import {
  useDiscardGoal,
  useCreateGoal,
  useGoalMetrics,
  useGoalReferenceOptions,
  useGoalStartSuggestion,
} from '../api/useGoals';
import { todayKey } from '../dates';
import { formatGoalTarget, formatGoalValue } from '../format';
import { noReference, validateGoalValues, validatePeriod } from '../goal';
import type {
  GoalCreatePreset,
  GoalMetric,
  GoalReferenceOption,
  GoalUnit,
  GoalVisibility,
} from '../types';
import {
  createSteps,
  formatGoalDay,
  formatGoalPeriod,
  matchingPeriodChoice,
  PERIOD_CHOICES,
  periodEnd,
  roundGoalValue,
  sharingNote,
  minGoalRange,
  targetWheelStart,
  unitCaption,
  wheelStep,
  type CreateStep,
} from '../view';
import { DateRow, VisibilityChoice } from './GoalFields';
import { FlowStepHeader, GoalValueWheel } from './GoalBits';

const lastUsed = new Intl.DateTimeFormat('de', { day: 'numeric', month: 'short' });

/** What the person has chosen so far (undefined: not touched, the suggestion applies). */
interface Answers {
  metric: string | null;
  option: GoalReferenceOption | null;
  reps: number | null;
  start: number | null | undefined;
  target: number | null;
  min: number | null;
  startsOn: string;
  endsOn: string;
  visibility: GoalVisibility;
}

function freshAnswers(today: string, preset: GoalCreatePreset | null): Answers {
  return {
    metric: preset?.metric ?? null,
    option: null,
    reps: null,
    start: undefined,
    target: null,
    min: null,
    startsOn: preset?.startsOn ?? today,
    endsOn: preset?.endsOn ?? periodEnd(today, '8w'),
    visibility: preset?.visibility ?? 'private',
  };
}

/**
 * A new goal, one thing per screen: metric → what it is about (exercise, habit, measure)
 * → reps (weight exercises) → start (levels; prefilled) → target → minimum (skippable) →
 * period → visibility → summary. Saving closes at once with "Rückgängig"; closing with
 * something chosen asks before throwing it away. Inside a frame (`preset`, the season setup)
 * period and visibility are given and their screens left out; a preset metric skips the
 * first screen.
 */
export function GoalCreateFlow({
  open,
  onOpenChange,
  preset = null,
  title = 'Neues Ziel',
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preset?: GoalCreatePreset | null;
  title?: string;
  /** After the goal is saved (e.g. to link it to the season). */
  onCreated?: (goalId: string) => void;
}) {
  // The mutations live here, outside the screens, so "Rückgängig" still works after closing.
  const create = useCreateGoal();
  const discard = useDiscardGoal();
  const metrics = useGoalMetrics().data ?? [];
  const [today] = useState(todayKey);
  const [answers, setAnswers] = useState<Answers>(() => freshAnswers(today, preset));
  const [index, setIndex] = useState(0);
  const [confirming, setConfirming] = useState(false);

  // A fresh start each time it opens (state adjusted while rendering).
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setAnswers(freshAnswers(today, preset));
      setIndex(0);
      setConfirming(false);
    }
  }

  const metric = metrics.find((m) => m.key === answers.metric) ?? null;
  const option = answers.option;
  const unit: GoalUnit | null = metric ? (metric.unit ?? option?.unit ?? null) : null;
  const steps = createSteps(metric, option).filter(
    (s) =>
      !preset ||
      (s !== 'period' && s !== 'visibility' && (s !== 'metric' || preset.metric === undefined)),
  );
  const step: CreateStep = steps[index] ?? 'metric';
  const counted = steps.filter((s) => s !== 'summary');
  const counter =
    step === 'summary'
      ? null
      : `${String(counted.indexOf(step) + 1)} von ${String(counted.length)}`;

  const referenceReady = metric !== null && (metric.reference === null || option !== null);
  const suggestion = useGoalStartSuggestion(
    referenceReady
      ? {
          metric: metric.key,
          reference: option?.reference ?? noReference,
          reps: option?.needsReps ? answers.reps : null,
        }
      : null,
  ).data;
  const suggestedStart =
    suggestion?.value != null && unit
      ? // An exercise's best set is exact (57,5 kg); trends and averages are rounded.
        metric?.key === 'exercise_best'
        ? suggestion.value
        : roundGoalValue(suggestion.value, unit)
      : null;
  // Levels: what was entered, else the suggestion. Rates: the suggestion as the baseline.
  const start =
    metric?.kind === 'rate'
      ? suggestedStart
      : answers.start === undefined
        ? suggestedStart
        : answers.start;
  const reps = option?.needsReps ? (answers.reps ?? suggestion?.reps ?? null) : null;

  const valuesError = metric
    ? validateGoalValues(metric, {
        startValue: start,
        minValue: answers.min,
        targetValue: answers.target,
      })
    : null;
  const periodError = validatePeriod(answers.startsOn, answers.endsOn);

  const set = (patch: Partial<Answers>) => {
    setAnswers((a) => ({ ...a, ...patch }));
  };
  const next = () => {
    setIndex((i) => Math.min(i + 1, steps.length - 1));
  };
  const back =
    index > 0
      ? () => {
          setIndex(index - 1);
        }
      : undefined;
  const goTo = (target: CreateStep) => {
    const i = steps.indexOf(target);
    if (i >= 0) setIndex(i);
  };

  function requestClose() {
    const chosen =
      preset?.metric !== undefined
        ? answers.option !== null || answers.target !== null
        : answers.metric !== null;
    if (chosen) setConfirming(true);
    else onOpenChange(false);
  }

  function save() {
    if (!metric || !unit || answers.target === null) return;
    const id = crypto.randomUUID();
    onOpenChange(false);
    // A promise, not callbacks: what follows (onCreated) must run even when the caller's
    // screen is gone by then.
    create
      .mutateAsync({
        input: {
          id,
          metric: metric.key,
          reference: option?.reference ?? noReference,
          reps,
          startsOn: answers.startsOn,
          endsOn: answers.endsOn,
          startValue: start,
          minValue: answers.min,
          targetValue: answers.target,
          visibility: answers.visibility,
        },
        display: {
          metric,
          unit,
          referenceLabel: option?.label ?? null,
          referenceDetail: option?.detail ?? null,
        },
      })
      .then(
        () => {
          onCreated?.(id);
        },
        () => {
          showToast('Ziel konnte nicht gespeichert werden.');
        },
      );
    showToast('Ziel angelegt', {
      label: 'Rückgängig',
      onAction: () => {
        discard.mutate(id);
      },
    });
  }

  let content: ReactNode = null;
  if (step === 'metric') {
    content = (
      <Screen
        header={<FlowStepHeader onBack={undefined} counter={counter} />}
        title="Was willst du erreichen?"
      >
        <ul className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
          {metrics.map((m) => (
            <li key={m.key}>
              <OptionRow
                label={m.label}
                detail={m.description}
                selected={m.key === answers.metric}
                onSelect={() => {
                  if (m.key !== answers.metric) {
                    // Another metric: what came after it no longer fits.
                    set({
                      ...freshAnswers(today, preset),
                      metric: m.key,
                      visibility: answers.visibility,
                    });
                  }
                  setIndex(1);
                }}
              />
            </li>
          ))}
        </ul>
      </Screen>
    );
  } else if (step === 'reference' && metric) {
    content = (
      <ReferenceStep
        metric={metric}
        selected={option}
        header={<FlowStepHeader onBack={back} counter={counter} />}
        onSelect={(picked) => {
          const same =
            option !== null &&
            JSON.stringify(option.reference) === JSON.stringify(picked.reference);
          if (!same) set({ option: picked, reps: null, start: undefined, target: null, min: null });
          next();
        }}
      />
    );
  } else if (step === 'reps' && metric) {
    content = (
      <Screen
        header={<FlowStepHeader onBack={back} counter={counter} />}
        title="Bei wie vielen Wiederholungen?"
        hint={`Das Ziel ist ein Gewicht, das du so oft schaffst. ${
          suggestion?.reps != null && answers.reps === null
            ? `Dein bester Satz der letzten 4 Wochen hatte ${String(suggestion.reps)}.`
            : ''
        }`}
        footer={
          <Button
            size="lg"
            missing={reps === null ? 'Wähl eine Anzahl Wiederholungen.' : null}
            onClick={() => {
              set({ reps });
              next();
            }}
          >
            Weiter
          </Button>
        }
      >
        <WheelCard caption="Wiederholungen">
          <NumberWheel
            value={reps}
            suggested={answers.reps === null && reps !== null}
            step={1}
            emptyStart={5}
            label="Wiederholungen"
            format={(v) => String(Math.round(v))}
            parse={(text) => Number.parseInt(text, 10)}
            onChange={(v) => {
              if (v >= 1) set({ reps: Math.round(v), start: undefined, target: null, min: null });
            }}
          />
        </WheelCard>
      </Screen>
    );
  } else if (step === 'start' && metric && unit) {
    const step_ = wheelStep(metric.key, unit, 'start');
    content = (
      <Screen
        header={<FlowStepHeader onBack={back} counter={counter} />}
        title="Wo stehst du jetzt?"
        hint="Von hier aus läuft die Linie zum Ziel."
        footer={
          <Button
            size="lg"
            missing={start === null ? 'Gib einen Startwert ein.' : null}
            onClick={() => {
              set({ start });
              next();
            }}
          >
            Weiter
          </Button>
        }
      >
        <WheelCard
          caption={`Start ${unitCaption(unit)}${reps !== null ? ` bei ${String(reps)} Wdh.` : ''}`}
          note={
            start === null
              ? 'Antippen und Wert eingeben'
              : answers.start === undefined && suggestion?.onDate
                ? `Vorschlag vom ${formatGoalDay(suggestion.onDate, today)}`
                : ''
          }
        >
          <GoalValueWheel
            value={start}
            suggested={answers.start === undefined && start !== null}
            step={step_}
            emptyStart={0}
            unit={unit}
            label={`Startwert ${unitCaption(unit)}`}
            onChange={(v) => {
              set({ start: v });
            }}
          />
        </WheelCard>
      </Screen>
    );
  } else if (step === 'target' && metric && unit) {
    const targetError = validateGoalValues(metric, {
      startValue: start,
      minValue: null,
      targetValue: answers.target,
    });
    content = (
      <Screen
        header={<FlowStepHeader onBack={back} counter={counter} />}
        title="Wo willst du hin?"
        hint={targetHint(metric, unit, start, reps)}
        footer={
          <Button
            size="lg"
            missing={targetError}
            onClick={() => {
              // A minimum that no longer fits the new target goes.
              if (
                answers.min !== null &&
                validateGoalValues(metric, {
                  startValue: start,
                  minValue: answers.min,
                  targetValue: answers.target,
                })
              ) {
                set({ min: null });
              }
              next();
            }}
          >
            Weiter
          </Button>
        }
      >
        <WheelCard
          caption={`Ziel ${unitCaption(unit)}`}
          note={answers.target === null ? 'Drehen oder antippen' : ''}
        >
          <GoalValueWheel
            value={answers.target}
            step={wheelStep(metric.key, unit, 'goal')}
            emptyStart={targetWheelStart(metric, unit, start)}
            unit={unit}
            label={`Ziel ${unitCaption(unit)}`}
            onChange={(v) => {
              set({ target: v });
            }}
          />
        </WheelCard>
      </Screen>
    );
  } else if (step === 'min' && metric && unit && answers.target !== null) {
    const goalStep = wheelStep(metric.key, unit, 'goal');
    const range = minGoalRange(metric.kind, start, answers.target, goalStep);
    // The wheel starts on a sensible value; "Weiter" takes what it shows.
    const shownMin = answers.min ?? range?.initial ?? null;
    content = (
      <Screen
        header={<FlowStepHeader onBack={back} counter={counter} />}
        title="Mindestziel"
        hint="Das Mindestziel ist, worauf du dich festlegst – das Ziel, was du erreichen willst. Optional."
        footer={
          <>
            <Button
              size="lg"
              missing={
                shownMin === null
                  ? 'Hier ist kein Platz für ein Mindestziel – wähle „Ohne Mindestziel“.'
                  : validateGoalValues(metric, {
                      startValue: start,
                      minValue: shownMin,
                      targetValue: answers.target,
                    })
              }
              onClick={() => {
                set({ min: shownMin });
                next();
              }}
            >
              Weiter
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                set({ min: null });
                next();
              }}
            >
              Ohne Mindestziel
            </Button>
          </>
        }
      >
        <WheelCard
          caption={`Mindestziel ${unitCaption(unit)}`}
          note={`Ziel: ${formatGoalTarget(answers.target, { unit, reps })}`}
        >
          <GoalValueWheel
            value={shownMin}
            suggested={answers.min === null}
            step={goalStep}
            emptyStart={shownMin ?? 0}
            unit={unit}
            label={`Mindestziel ${unitCaption(unit)}`}
            min={range?.min}
            max={range?.max}
            onChange={(v) => {
              set({ min: v });
            }}
          />
        </WheelCard>
      </Screen>
    );
  } else if (step === 'period') {
    const choice = matchingPeriodChoice(answers.startsOn, answers.endsOn);
    content = (
      <Screen
        header={<FlowStepHeader onBack={back} counter={counter} />}
        title="Bis wann?"
        hint="Die Linie zum Ziel läuft vom Start bis zum letzten Tag."
        footer={
          <Button size="lg" missing={periodError} onClick={next}>
            Weiter
          </Button>
        }
      >
        <div className="flex flex-wrap gap-2">
          {PERIOD_CHOICES.map((c) => (
            <Chip
              key={c.value}
              selected={choice === c.value}
              onClick={() => {
                set({ endsOn: periodEnd(answers.startsOn, c.value) });
              }}
            >
              {c.label}
            </Chip>
          ))}
        </div>
        <ul className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
          <DateRow
            label="Start"
            day={answers.startsOn}
            today={today}
            onChange={(day) => {
              // Keep the chosen length when the start moves.
              set({
                startsOn: day,
                endsOn: choice ? periodEnd(day, choice) : answers.endsOn,
              });
            }}
          />
          <DateRow
            label="Ende"
            day={answers.endsOn}
            today={today}
            min={answers.startsOn}
            onChange={(day) => {
              set({ endsOn: day });
            }}
          />
        </ul>
      </Screen>
    );
  } else if (step === 'visibility' && metric) {
    content = (
      <Screen
        header={<FlowStepHeader onBack={back} counter={counter} />}
        title="Wer sieht das Ziel?"
        footer={
          <Button size="lg" onClick={next}>
            Weiter
          </Button>
        }
      >
        <VisibilityChoice
          value={answers.visibility}
          note={sharingNote(metric.key)}
          onChange={(visibility) => {
            set({ visibility });
          }}
        />
      </Screen>
    );
  } else if (step === 'summary' && metric && unit) {
    const rows: { step: CreateStep; label: string; value: string }[] = [
      { step: 'metric', label: 'Messgröße', value: metric.label },
      ...(option
        ? [
            {
              step: 'reference' as const,
              label: referenceNoun(metric),
              value: option.detail ? `${option.label} · ${option.detail}` : option.label,
            },
          ]
        : []),
      ...(reps !== null
        ? [{ step: 'reps' as const, label: 'Wiederholungen', value: String(reps) }]
        : []),
      ...(metric.kind === 'level'
        ? [{ step: 'start' as const, label: 'Start', value: formatGoalValue(start, unit) }]
        : start !== null
          ? [{ step: 'target' as const, label: 'Bisher', value: rateBaseline(metric, unit, start) }]
          : []),
      { step: 'target', label: 'Ziel', value: formatGoalTarget(answers.target, { unit, reps }) },
      {
        step: 'min',
        label: 'Mindestziel',
        value: answers.min === null ? 'keins' : formatGoalTarget(answers.min, { unit, reps }),
      },
      {
        step: 'period',
        label: 'Zeitraum',
        value: formatGoalPeriod(answers.startsOn, answers.endsOn, today),
      },
      {
        step: 'visibility',
        label: 'Sichtbar für',
        value: answers.visibility === 'shared' ? 'Gruppe' : 'Nur mich',
      },
    ];
    content = (
      <Screen
        header={<FlowStepHeader onBack={back} />}
        title="Übersicht"
        footer={
          <Button size="lg" missing={valuesError ?? periodError} onClick={save}>
            Speichern
          </Button>
        }
      >
        <ul className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
          {rows.map((row) => (
            <li key={row.label}>
              {steps.includes(row.step) ? (
                <button
                  type="button"
                  onClick={() => {
                    goTo(row.step);
                  }}
                  className="flex min-h-tap w-full items-center gap-3 px-4 py-2 text-left active:bg-surface-3"
                >
                  <span className="shrink-0 text-body">{row.label}</span>
                  <span className="min-w-0 flex-1 text-right text-subhead text-text-muted tabular-nums">
                    {row.value}
                  </span>
                  <ChevronRightIcon aria-hidden className="shrink-0 text-text-subtle" />
                </button>
              ) : (
                <div className="flex min-h-tap w-full items-center gap-3 px-4 py-2">
                  <span className="shrink-0 text-body">{row.label}</span>
                  <span className="min-w-0 flex-1 text-right text-subhead text-text-muted tabular-nums">
                    {row.value}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
        {(valuesError ?? periodError) && (
          <p className="text-footnote text-danger">{valuesError ?? periodError}</p>
        )}
      </Screen>
    );
  }

  return (
    <>
      <Sheet
        fullHeight
        open={open && !confirming}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) requestClose();
        }}
        title={title}
        // One height for every screen: the sheet does not jump between them.
        className="min-h-sheet-min"
      >
        {content}
      </Sheet>
      <Sheet
        open={open && confirming}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setConfirming(false);
        }}
        title="Ziel verwerfen?"
        description="Was du gewählt hast, wird nicht gespeichert."
      >
        <div className="flex flex-col gap-2">
          <Button
            variant="danger"
            fullWidth
            onClick={() => {
              setConfirming(false);
              onOpenChange(false);
            }}
          >
            Verwerfen
          </Button>
          <Button
            variant="ghost"
            fullWidth
            onClick={() => {
              setConfirming(false);
            }}
          >
            Weitermachen
          </Button>
        </div>
      </Sheet>
    </>
  );
}

function referenceNoun(metric: GoalMetric): string {
  if (metric.reference === 'exercise') return 'Übung';
  if (metric.reference === 'habit') return 'Habit';
  return 'Maß';
}

/** Rates: what the last 4 weeks looked like, "Ø 2,5 pro Woche" / "78 %". */
function rateBaseline(metric: GoalMetric, unit: GoalUnit, value: number): string {
  return metric.key === 'trainings_per_week'
    ? `Ø ${formatGoalValue(value, unit)}`
    : formatGoalValue(value, unit);
}

function targetHint(metric: GoalMetric, unit: GoalUnit, start: number | null, reps: number | null) {
  if (metric.kind === 'rate') {
    const base =
      start === null
        ? 'In den letzten 4 Wochen gab es noch nichts zu zählen.'
        : `In den letzten 4 Wochen: ${rateBaseline(metric, unit, start)}.`;
    return metric.key === 'trainings_per_week'
      ? `Wie viele Trainings pro Woche? Ein Training pro Tag zählt. ${base}`
      : `An wie viel Prozent der Tage willst du es schaffen? Das Habit sagt, was ein guter Tag ist. ${base}`;
  }
  return `Start: ${formatGoalTarget(start, { unit, reps })}.`;
}

/** A flow screen: header line, title, a hint, the content, and the buttons at the bottom. */
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

function WheelCard({
  caption,
  note,
  children,
}: {
  caption: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-card bg-surface-2 py-3">
      <span className="text-footnote text-text-muted">{caption}</span>
      {children}
      {/* Always one line, so the wheel does not move when the text goes. */}
      <span className="min-h-5 text-footnote text-text-subtle">{note ?? ''}</span>
    </div>
  );
}

function OptionRow({
  label,
  detail,
  selected,
  onSelect,
}: {
  label: string;
  detail: string | null;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="flex min-h-tap w-full items-center gap-3 px-4 py-2.5 text-left active:bg-surface-3"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body">{label}</span>
        {detail && <span className="text-footnote text-text-muted">{detail}</span>}
      </span>
      {selected ? (
        <CheckIcon aria-hidden className="shrink-0 text-accent" />
      ) : (
        <ChevronRightIcon aria-hidden className="shrink-0 text-text-subtle" />
      )}
    </button>
  );
}

function ReferenceStep({
  metric,
  selected,
  header,
  onSelect,
}: {
  metric: GoalMetric;
  selected: GoalReferenceOption | null;
  header: ReactNode;
  onSelect: (option: GoalReferenceOption) => void;
}) {
  const options = useGoalReferenceOptions(metric.key);
  const list = options.data ?? [];
  const title =
    metric.reference === 'exercise'
      ? 'Welche Übung?'
      : metric.reference === 'habit'
        ? 'Welches Habit?'
        : 'Welches Maß?';
  const empty =
    metric.reference === 'exercise'
      ? 'Noch keine Übung abgeschlossen. Sobald du eine im Training gemacht hast, kannst du hier ein Ziel dafür setzen.'
      : metric.reference === 'habit'
        ? 'Noch kein Habit. Leg zuerst eins unter Ich → Habits an.'
        : 'Keine Maße gefunden.';
  return (
    <Screen
      header={header}
      title={title}
      hint={
        metric.reference === 'exercise'
          ? 'Zuletzt trainierte zuerst. Ein eigenes Gerät zählt für sich.'
          : undefined
      }
    >
      {options.isPending ? null : list.length === 0 ? (
        <p className="py-6 text-center text-subhead text-text-subtle">{empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
          {list.map((o) => (
            <li key={JSON.stringify(o.reference)}>
              <OptionRow
                label={o.label}
                detail={
                  [
                    o.detail,
                    o.lastUsedOn
                      ? `zuletzt ${lastUsed.format(new Date(`${o.lastUsedOn}T12:00:00`))}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || null
                }
                selected={
                  selected !== null &&
                  JSON.stringify(selected.reference) === JSON.stringify(o.reference)
                }
                onSelect={() => {
                  onSelect(o);
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}
