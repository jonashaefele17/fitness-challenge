import { useState } from 'react';
import { WorkoutLog } from '@/features/training';
import { Card, Screen, SegmentedControl } from '@/shared/ui';

type Section = 'calendar' | 'templates';

/** "Was mache ich wann?": training log and (next) my templates. */
export function TrainingRoute() {
  const [section, setSection] = useState<Section>('calendar');
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
          <Card className="text-subhead text-text-muted">
            Hier kommen deine Vorlagen hin – als Nächstes dran.
          </Card>
        )}
      </div>
    </Screen>
  );
}
