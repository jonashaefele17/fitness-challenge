import { useContext, useState } from 'react';
import { Button, Sheet } from '@/shared/ui';
import { useTemplates } from '../../api/useTemplates';
import { useStartWorkout } from '../../api/useWorkout';
import type { PlanOccurrence } from '../../types';
import { OpenLiveWorkoutContext } from './open-live';

/**
 * Starts the training of a planned date: with its template, or (several) after asking
 * which one today; without one, free. Opens the running workout.
 */
export function PlanStartButton({
  plan,
  size = 'md',
  label = 'Starten',
  onStarted,
}: {
  plan: PlanOccurrence;
  size?: 'md' | 'lg';
  label?: string;
  onStarted?: () => void;
}) {
  const start = useStartWorkout();
  const openLive = useContext(OpenLiveWorkoutContext);
  const templates = useTemplates().data ?? [];
  const [choosing, setChoosing] = useState(false);
  const options = plan.templateIds.flatMap((id) => templates.filter((t) => t.id === id));

  function go(templateId: string | undefined) {
    if (!plan.trainingType) return;
    start.mutate(
      {
        trainingTypeId: plan.trainingType.id,
        templateId,
        plan: { id: plan.planId, onDate: plan.planDate },
      },
      {
        onSuccess: () => {
          setChoosing(false);
          onStarted?.();
          openLive?.();
        },
      },
    );
  }

  return (
    <>
      <Button
        size={size}
        loading={start.isPending && !choosing}
        onClick={() => {
          if (options.length > 1) setChoosing(true);
          else go(options[0]?.id);
        }}
      >
        {label}
      </Button>
      {start.isError && (
        <p role="alert" className="text-footnote text-danger">
          Starten hat nicht geklappt (läuft schon ein Training?).
        </p>
      )}
      <Sheet open={choosing} onOpenChange={setChoosing} title="Welche Vorlage heute?">
        <ul className="flex flex-col gap-2">
          {options.map((template) => (
            <li key={template.id}>
              <button
                type="button"
                disabled={start.isPending}
                onClick={() => {
                  go(template.id);
                }}
                className="flex min-h-tap w-full flex-col rounded-card bg-surface-2 px-4 py-3 text-left active:bg-surface-3 disabled:opacity-50"
              >
                <span className="text-subhead font-semibold">{template.name}</span>
                <span className="text-footnote text-text-muted">
                  {template.exerciseCount === 1
                    ? '1 Übung'
                    : `${String(template.exerciseCount)} Übungen`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
