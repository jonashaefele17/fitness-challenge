import { useState } from 'react';
import { useNavigate } from 'react-router';
import { TemplatesView, WorkoutLog } from '@/features/training';
import { paths } from '../paths';
import { Screen, SegmentedControl } from '@/shared/ui';

type Section = 'calendar' | 'templates';

/** "Was mache ich wann?": training log and (next) my templates. */
export function TrainingRoute() {
  const [section, setSection] = useState<Section>('calendar');
  const navigate = useNavigate();
  return (
    <Screen title="Training">
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
          <WorkoutLog />
        ) : (
          <TemplatesView
            onStarted={() => {
              void navigate(paths.liveWorkout);
            }}
          />
        )}
      </div>
    </Screen>
  );
}
