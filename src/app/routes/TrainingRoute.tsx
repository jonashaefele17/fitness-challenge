import { useState } from 'react';
import { WorkoutCalendar } from '@/features/training';
import { Card, Screen, SegmentedControl } from '@/shared/ui';

type Section = 'calendar' | 'templates';

/** "Was mache ich wann?": calendar of workouts and (next) my templates. */
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
          <WorkoutCalendar />
        ) : (
          <Card className="text-subhead text-text-muted">
            Hier kommen deine Vorlagen hin – als Nächstes dran.
          </Card>
        )}
      </div>
    </Screen>
  );
}
