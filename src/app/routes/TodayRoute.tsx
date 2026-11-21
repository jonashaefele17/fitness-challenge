import { useUserId } from '@/features/auth';
import { NotificationBell } from '@/features/notifications';
import { useMyProfile } from '@/features/profile';
import { TodayPlans } from '@/features/training';
import { Card, Screen } from '@/shared/ui';
import { useOpenTarget } from '../targets';

export function TodayRoute() {
  const profile = useMyProfile(useUserId());
  const openTarget = useOpenTarget();
  const name = profile.data?.displayName;

  return (
    <Screen title="Heute" accessory={<NotificationBell onOpenTarget={openTarget} />}>
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-1">
          <p className="text-title-3 font-semibold">{name ? `Hallo ${name}!` : 'Hallo!'}</p>
          <p className="text-subhead text-text-muted">
            Hier erscheinen bald deine geplanten Trainings, dein Check-in und was es Neues gibt.
          </p>
        </Card>
        <TodayPlans />
      </div>
    </Screen>
  );
}
