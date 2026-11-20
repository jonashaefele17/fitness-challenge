import { useSignOut, useUserId } from '@/features/auth';
import { useActiveGroup } from '@/features/groups';
import { Avatar, useMyProfile } from '@/features/profile';
import { Button, Card, Screen } from '@/shared/ui';

const roleLabels = { admin: 'Admin', member: 'Mitglied' } as const;

export function MeRoute() {
  const profile = useMyProfile(useUserId());
  const { group } = useActiveGroup();
  const signOut = useSignOut();

  return (
    <Screen title="Ich">
      <div className="flex flex-col gap-4">
        {profile.data && (
          <Card className="flex items-center gap-4">
            <Avatar profile={profile.data} size="lg" />
            <div className="flex min-w-0 flex-col">
              <p className="truncate text-title-3 font-semibold">{profile.data.displayName}</p>
              <p className="truncate text-subhead text-text-muted">
                {profile.data.homeGym ?? 'Kein Heimstudio angegeben'}
              </p>
              <p className="text-footnote text-text-subtle">
                {group.name} · {roleLabels[group.role]}
              </p>
            </div>
          </Card>
        )}
        <Card className="text-subhead text-text-muted">
          Hier kommen Kraftverlauf, Ziele, Habits und Einstellungen hin.
        </Card>
        <Button
          variant="danger"
          fullWidth
          loading={signOut.isPending}
          onClick={() => {
            signOut.mutate();
          }}
        >
          Abmelden
        </Button>
      </div>
    </Screen>
  );
}
