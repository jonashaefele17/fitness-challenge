import { useContext, useState } from 'react';
import { useUserId } from '@/features/auth';
import { Button, Sheet, TextField } from '@/shared/ui';
import { useChangePlanDate, useDeletePlan, usePlan, useSkipPlanDate } from '../../api/usePlans';
import { useTemplates } from '../../api/useTemplates';
import type { PlanDraft, PlanOccurrence } from '../../types';
import { PlanForm } from './PlanForm';
import { PlanStartButton } from './PlanStartButton';
import { PlanTargetPicker, type PlanTarget } from './PlanTargetPicker';
import { planTitle, repeatText } from './planText';
import { PlanSocialContext } from './social';

const longDate = new Intl.DateTimeFormat('de', { weekday: 'long', day: 'numeric', month: 'long' });

type Step = 'detail' | 'edit' | 'change' | 'redo' | 'confirm-cancel' | 'confirm-delete';

/**
 * One planned date: what (type, focus, templates), when, and (mine) start, edit the series,
 * change only this date, cancel, make up, delete.
 */
export function PlanDetailSheet({
  plan,
  today,
  onClose,
}: {
  plan: PlanOccurrence | null;
  /** "2026-12-07" */
  today: string;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>('detail');
  const mine = plan?.userId === useUserId();
  const draft = usePlan(plan && mine ? plan.planId : null).data ?? null;
  const templates = useTemplates().data ?? [];
  const templateNames = (plan?.templateIds ?? []).flatMap(
    (id) => templates.find((t) => t.id === id)?.name ?? [],
  );
  const skip = useSkipPlanDate();
  const change = useChangePlanDate();
  const remove = useDeletePlan();
  const { Detail } = useContext(PlanSocialContext);

  function close() {
    setStep('detail');
    onClose();
  }

  const title =
    step === 'edit'
      ? 'Serie bearbeiten'
      : step === 'change'
        ? 'Nur diesen Termin'
        : step === 'redo'
          ? 'Nachholen'
          : plan
            ? planTitle(plan)
            : 'Termin';

  return (
    <Sheet
      open={plan !== null}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      title={title}
    >
      {plan && step === 'detail' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 text-subhead text-text-muted">
            <span>
              {longDate.format(new Date(`${plan.onDate}T12:00:00`))}
              {plan.startTime ? ` · ${plan.startTime} Uhr` : ''}
            </span>
            {plan.focus && <span>Fokus: {plan.focus.name}</span>}
            {templateNames.length > 0 && (
              <span>
                {templateNames.length === 1 ? 'Vorlage' : 'Vorlagen'}: {templateNames.join(', ')}
              </span>
            )}
            {plan.recurring && draft && <span>{repeatText(draft)}</span>}
            {plan.changed && <span>Nur dieser Termin geändert</span>}
            {plan.status === 'cancelled' && <span className="text-danger">Abgesagt</span>}
            {plan.note && <span className="text-text">{plan.note}</span>}
          </div>

          {Detail && plan.status !== 'done' && <Detail plan={plan} />}

          {mine && (
            <div className="flex flex-col gap-2">
              {plan.kind === 'training' &&
                plan.status === 'planned' &&
                plan.onDate === today &&
                plan.trainingType && (
                  <PlanStartButton
                    plan={plan}
                    size="lg"
                    label="Training starten"
                    onStarted={close}
                  />
                )}
              {plan.status !== 'done' && plan.recurring && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setStep('change');
                  }}
                >
                  Nur diesen Termin ändern
                </Button>
              )}
              {plan.status !== 'done' && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setStep('edit');
                  }}
                >
                  {plan.recurring ? 'Serie bearbeiten' : 'Bearbeiten'}
                </Button>
              )}
              {plan.status === 'planned' && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setStep('confirm-cancel');
                  }}
                >
                  {plan.recurring ? 'Diesen Termin absagen' : 'Absagen'}
                </Button>
              )}
              {plan.status === 'cancelled' && (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setStep('redo');
                    }}
                  >
                    Nachholen
                  </Button>
                  <Button
                    variant="ghost"
                    loading={skip.isPending}
                    onClick={() => {
                      skip.mutate(
                        { planId: plan.planId, planDate: plan.planDate, skip: false },
                        { onSuccess: close },
                      );
                    }}
                  >
                    Findet doch statt
                  </Button>
                </>
              )}
              {plan.changed && plan.status !== 'done' && (
                <Button
                  variant="ghost"
                  loading={change.isPending}
                  onClick={() => {
                    change.mutate(
                      {
                        change: {
                          planId: plan.planId,
                          planDate: plan.planDate,
                          onDate: plan.planDate,
                          startTime: '',
                          focusId: null,
                          templateIds: [],
                        },
                        reset: true,
                      },
                      { onSuccess: close },
                    );
                  }}
                >
                  Wieder wie in der Serie
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={() => {
                  setStep('confirm-delete');
                }}
              >
                {plan.recurring ? 'Ganze Serie löschen' : 'Termin löschen'}
              </Button>
            </div>
          )}
        </div>
      )}

      {plan && step === 'confirm-cancel' && (
        <div className="flex flex-col gap-3">
          <p className="text-subhead text-text-muted">
            Der Termin wird grau angezeigt. Über „Nachholen“ legst du ihn neu an.
          </p>
          <Button
            variant="danger"
            loading={skip.isPending}
            onClick={() => {
              skip.mutate(
                { planId: plan.planId, planDate: plan.planDate, skip: true },
                { onSuccess: close },
              );
            }}
          >
            Absagen
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setStep('detail');
            }}
          >
            Doch nicht
          </Button>
        </div>
      )}

      {plan && step === 'confirm-delete' && (
        <div className="flex flex-col gap-3">
          <p className="text-subhead text-text-muted">
            {plan.recurring
              ? 'Alle Termine dieser Serie verschwinden. Schon erledigte Trainings bleiben.'
              : 'Der Termin verschwindet. Ein schon erledigtes Training bleibt.'}
          </p>
          <Button
            variant="danger"
            loading={remove.isPending}
            onClick={() => {
              remove.mutate(plan.planId, { onSuccess: close });
            }}
          >
            Löschen
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setStep('detail');
            }}
          >
            Doch nicht
          </Button>
        </div>
      )}

      {step === 'edit' && draft && <PlanForm initial={draft} onSaved={close} />}
      {step === 'redo' && plan && draft && (
        <PlanForm initial={redoDraft(draft, plan, today)} onSaved={close} />
      )}
      {step === 'change' && plan && <ChangeDateForm plan={plan} onSaved={close} />}
    </Sheet>
  );
}

/** "Nachholen": this training once more (its focus and templates), today by default. */
function redoDraft(draft: PlanDraft, plan: PlanOccurrence, today: string): PlanDraft {
  return {
    ...draft,
    id: null,
    startsOn: today,
    startTime: plan.startTime ?? '',
    focusId: plan.focus?.id ?? null,
    templateIds: plan.templateIds,
    repeatWeekdays: [],
    repeatUntil: '',
    days: [],
  };
}

/** "Nur diesen Termin ändern": day, time, focus and templates of one date. */
function ChangeDateForm({ plan, onSaved }: { plan: PlanOccurrence; onSaved: () => void }) {
  const [onDate, setOnDate] = useState(plan.onDate);
  const [startTime, setStartTime] = useState(plan.startTime ?? '');
  const [target, setTarget] = useState<PlanTarget>({
    focusId: plan.focus?.id ?? null,
    templateIds: plan.templateIds,
  });
  const change = useChangePlanDate();
  return (
    <form
      className="flex flex-col gap-6 pt-1"
      onSubmit={(event) => {
        event.preventDefault();
        change.mutate(
          {
            change: {
              planId: plan.planId,
              planDate: plan.planDate,
              onDate,
              startTime,
              focusId: target.focusId,
              templateIds: target.templateIds,
            },
          },
          { onSuccess: onSaved },
        );
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Tag"
          type="date"
          className="h-tap appearance-none"
          value={onDate}
          onChange={(event) => {
            setOnDate(event.target.value);
          }}
        />
        <TextField
          label="Uhrzeit (optional)"
          type="time"
          className="h-tap appearance-none"
          value={startTime}
          onChange={(event) => {
            setStartTime(event.target.value);
          }}
        />
      </div>
      {plan.kind === 'training' && plan.trainingType && (
        <PlanTargetPicker
          trainingTypeId={plan.trainingType.id}
          value={target}
          onChange={setTarget}
        />
      )}
      {change.isError && (
        <p role="alert" className="text-footnote text-danger">
          Speichern hat nicht geklappt.
        </p>
      )}
      <Button
        type="submit"
        size="lg"
        missing={onDate ? null : 'Wähl einen Tag.'}
        loading={change.isPending}
      >
        Nur diesen Termin speichern
      </Button>
    </form>
  );
}
