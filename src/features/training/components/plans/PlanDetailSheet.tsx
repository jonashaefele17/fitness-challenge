import { useContext, useState } from 'react';
import { useUserId } from '@/features/auth';
import { Button, Sheet } from '@/shared/ui';
import { useDeletePlan, usePlan, useSkipPlanDate } from '../../api/usePlans';
import { useTemplates } from '../../api/useTemplates';
import { useStartWorkout } from '../../api/useWorkout';
import type { PlanDraft, PlanOccurrence } from '../../types';
import { OpenLiveWorkoutContext } from './open-live';
import { PlanForm } from './PlanForm';
import { planTitle, repeatText } from './planText';

const longDate = new Intl.DateTimeFormat('de', { weekday: 'long', day: 'numeric', month: 'long' });

type Step = 'detail' | 'edit' | 'redo' | 'confirm-cancel' | 'confirm-delete';

/** One planned date: what, when, and (mine) start, edit, cancel, make up, delete. */
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
  const template = templates.find((t) => t.id === plan?.templateId);
  const skip = useSkipPlanDate();
  const remove = useDeletePlan();
  const start = useStartWorkout();
  const openLive = useContext(OpenLiveWorkoutContext);

  function close() {
    setStep('detail');
    onClose();
  }

  const title =
    step === 'edit'
      ? 'Termin bearbeiten'
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
            {template && <span>Vorlage: {template.name}</span>}
            {plan.recurring && draft && <span>{repeatText(draft)}</span>}
            {plan.status === 'cancelled' && <span className="text-danger">Abgesagt</span>}
            {plan.note && <span className="text-text">{plan.note}</span>}
          </div>

          {mine && (
            <div className="flex flex-col gap-2">
              {plan.kind === 'training' &&
                plan.status === 'planned' &&
                plan.onDate === today &&
                plan.trainingType && (
                  <Button
                    size="lg"
                    loading={start.isPending}
                    onClick={() => {
                      if (!plan.trainingType) return;
                      start.mutate(
                        {
                          trainingTypeId: plan.trainingType.id,
                          templateId: plan.templateId ?? undefined,
                          plan: { id: plan.planId, onDate: plan.onDate },
                        },
                        {
                          onSuccess: () => {
                            close();
                            openLive?.();
                          },
                        },
                      );
                    }}
                  >
                    Training starten
                  </Button>
                )}
              {start.isError && (
                <p role="alert" className="text-footnote text-danger">
                  Starten hat nicht geklappt (läuft schon ein Training?).
                </p>
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
                        { planId: plan.planId, onDate: plan.onDate, skip: false },
                        { onSuccess: close },
                      );
                    }}
                  >
                    Findet doch statt
                  </Button>
                </>
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
                { planId: plan.planId, onDate: plan.onDate, skip: true },
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
        <PlanForm initial={redoDraft(draft, today)} onSaved={close} />
      )}
    </Sheet>
  );
}

/** "Nachholen": the same training once more, today by default. */
function redoDraft(draft: PlanDraft, today: string): PlanDraft {
  return { ...draft, id: null, startsOn: today, repeatWeekdays: [], repeatUntil: '' };
}
