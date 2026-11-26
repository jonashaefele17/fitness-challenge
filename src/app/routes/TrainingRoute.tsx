import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { DayWeight } from '@/features/body';
import { NotificationBell } from '@/features/notifications';
import { LinkedPlanSheet, TemplatesView, WorkoutLog } from '@/features/training';
import { paths } from '../paths';
import { targetParams, useOpenTarget } from '../targets';
import { Screen, SegmentedControl } from '@/shared/ui';

type Section = 'calendar' | 'templates';

/** "Was mache ich wann?": training log and (next) my templates. */
export function TrainingRoute() {
  const [section, setSection] = useState<Section>('calendar');
  const navigate = useNavigate();
  // Linked from a notification: a plan to open.
  const [params, setParams] = useSearchParams();
  const openTarget = useOpenTarget();
  return (
    <Screen title="Training" accessory={<NotificationBell onOpenTarget={openTarget} />}>
      <div className="flex flex-col gap-4">
        <SegmentedControl
          label="Bereich"
          value={section}
          onChange={setSection}
          options={[
            { value: 'calendar', label: 'Kalender' },
            { value: 'templates', label: 'Vorlagen' },
          ]}
        />
        {section === 'calendar' ? (
          <WorkoutLog daySpecial={(day) => <DayWeight day={day} />} />
        ) : (
          <TemplatesView
            onStarted={() => {
              void navigate(paths.liveWorkout);
            }}
          />
        )}
      </div>
      <LinkedPlanSheet
        planId={params.get(targetParams.plan)}
        onClose={() => {
          setParams({}, { replace: true });
        }}
      />
    </Screen>
  );
}
