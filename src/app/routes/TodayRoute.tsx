import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useUserId } from '@/features/auth';
import { WeighTodayCard } from '@/features/body';
import { CheckIn } from '@/features/habits';
import { NotificationBell, RecentNotifications } from '@/features/notifications';
import { useMyProfile } from '@/features/profile';
import { Screen } from '@/shared/ui';
import { targetParams, useOpenTarget } from '../targets';
import { TodayHero } from '../today/TodayHero';
import { WeekStrip } from '../today/WeekStrip';

const dateLine = new Intl.DateTimeFormat('de', { weekday: 'long', day: 'numeric', month: 'long' });

/**
 * Heute: the most important thing right now (running training, today's plan, or an
 * invitation to train), training with others, the check-in, this week, and what is new.
 */
export function TodayRoute() {
  const profile = useMyProfile(useUserId());
  const openTarget = useOpenTarget();
  const [bellOpen, setBellOpen] = useState(false);
  // Opened from a reminder: the check-in at that habit.
  const [params, setParams] = useSearchParams();
  const [today] = useState(() => dateLine.format(new Date()));
  const name = profile.data?.displayName;

  return (
    <Screen
      eyebrow={today}
      title={name ? `Hallo ${name}` : 'Hallo'}
      accessory={
        <NotificationBell onOpenTarget={openTarget} open={bellOpen} onOpenChange={setBellOpen} />
      }
    >
      <div className="flex flex-col gap-4">
        <TodayHero />
        <CheckIn
          openHabitId={params.get(targetParams.checkin)}
          onOpened={() => {
            setParams({}, { replace: true });
          }}
        />
        <WeighTodayCard />
        <WeekStrip />
        <RecentNotifications
          onOpenTarget={openTarget}
          onShowAll={() => {
            setBellOpen(true);
          }}
        />
      </div>
    </Screen>
  );
}
