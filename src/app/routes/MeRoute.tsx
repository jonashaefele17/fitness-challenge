import { useSignOut, useUserId } from '@/features/auth';
import { useQueryClient } from '@tanstack/react-query';
import { groupKeys, useActiveGroup, useGroupMembers } from '@/features/groups';
import { NotificationSettingsPanel, useDisablePush } from '@/features/notifications';
import { Avatar, ColorPicker, useMyProfile, useSetMyColor } from '@/features/profile';
import { showToast } from '@/shared/lib';
import { Button, Card, Screen } from '@/shared/ui';

const roleLabels = { admin: 'Admin', member: 'Mitglied' } as const;

export function MeRoute() {
  const userId = useUserId();
  const profile = useMyProfile(userId);
  const { group } = useActiveGroup();
  const members = useGroupMembers(group.id).data ?? [];
  const setColor = useSetMyColor(userId);
  const queryClient = useQueryClient();
  const signOut = useSignOut();
  const disablePush = useDisablePush();

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
        {profile.data && (
          <Card className="flex flex-col gap-3">
            <div className="flex flex-col">
              <h2 className="text-subhead font-semibold">Deine Farbe</h2>
              <p className="text-footnote text-text-muted">
                Zeigt dich in Graphen, Kommentaren und am Avatar. Farben aus deiner Gruppe sind
                vergeben.
              </p>
            </div>
            <ColorPicker
              value={profile.data.color}
              taken={members.filter((m) => m.userId !== userId).map((m) => m.color)}
              onChange={(color) => {
                setColor.mutate(color, {
                  onSuccess: () => void queryClient.invalidateQueries({ queryKey: groupKeys.all }),
                  onError: (error) => {
                    showToast(
                      error.message.includes('color_taken')
                        ? 'Die Farbe hat gerade jemand anderes gewählt.'
                        : 'Farbe konnte nicht gespeichert werden.',
                    );
                  },
                });
              }}
            />
          </Card>
        )}
        <NotificationSettingsPanel />
        <Card className="text-subhead text-text-muted">
          Hier kommen Kraftverlauf, Ziele, Habits und weitere Einstellungen hin.
        </Card>
        <Button
          variant="danger"
          fullWidth
          loading={signOut.isPending || disablePush.isPending}
          onClick={() => {
            // This device should not receive the next person's notifications.
            disablePush.mutate(undefined, {
              onSettled: () => {
                signOut.mutate();
              },
            });
          }}
        >
          Abmelden
        </Button>
      </div>
    </Screen>
  );
}
