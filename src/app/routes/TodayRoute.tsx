import { useUserId } from '@/features/auth';
import { useMyProfile } from '@/features/profile';
import { Card, Screen } from '@/shared/ui';

export function TodayRoute() {
  const profile = useMyProfile(useUserId());
  const name = profile.data?.displayName;

  return (
    <Screen title="Heute">
      <Card className="flex flex-col gap-1">
        <p className="text-title-3 font-semibold">{name ? `Hallo ${name}!` : 'Hallo!'}</p>
        <p className="text-subhead text-text-muted">
          Hier erscheinen bald deine geplanten Trainings, dein Check-in und was es Neues gibt.
        </p>
      </Card>
    </Screen>
  );
}
