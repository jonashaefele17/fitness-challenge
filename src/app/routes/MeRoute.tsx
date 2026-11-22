import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useSignOut, useUserId } from '@/features/auth';
import { groupKeys, useActiveGroup, useGroupMembers } from '@/features/groups';
import { HabitsSettings } from '@/features/habits';
import {
  NotificationBell,
  NotificationSettingsPanel,
  useDisablePush,
} from '@/features/notifications';
import { Avatar, ColorPicker, useMyProfile, useSetMyColor } from '@/features/profile';
import { MyExercises, TrainingSettings, useHomeStudio, usePlaces } from '@/features/training';
import { showToast } from '@/shared/lib';
import { Button, Card, Screen, SegmentedControl } from '@/shared/ui';
import { useOpenTarget } from '../targets';

const roleLabels = { admin: 'Admin', member: 'Mitglied' } as const;

type Section = 'training' | 'habits' | 'settings';

/** "Wie entwickle ich mich?": my training progress, habits and all settings. */
export function MeRoute() {
  const userId = useUserId();
  const profile = useMyProfile(userId);
  const { group } = useActiveGroup();
  const homeId = useHomeStudio().data ?? null;
  const home = (usePlaces().data ?? []).find((place) => place.id === homeId);
  const [section, setSection] = useState<Section>('training');
  const openTarget = useOpenTarget();

  return (
    <Screen title="Ich" accessory={<NotificationBell onOpenTarget={openTarget} />}>
      <div className="flex flex-col gap-4">
        {profile.data && (
          <Card className="flex items-center gap-4">
            <Avatar profile={profile.data} size="lg" />
            <div className="flex min-w-0 flex-col">
              <p className="truncate text-title-3 font-semibold">{profile.data.displayName}</p>
              {home && <p className="truncate text-subhead text-text-muted">{home.name}</p>}
              <p className="text-footnote text-text-subtle">
                {group.name} · {roleLabels[group.role]}
              </p>
            </div>
          </Card>
        )}

        <SegmentedControl
          label="Bereich"
          value={section}
          onChange={setSection}
          options={[
            { value: 'training', label: 'Training' },
            { value: 'habits', label: 'Habits' },
            { value: 'settings', label: 'Einstellungen' },
          ]}
        />

        {section === 'training' && <MyExercises />}
        {section === 'habits' && <HabitsSettings />}
        {section === 'settings' && <Settings userId={userId} />}
      </div>
    </Screen>
  );
}

function Settings({ userId }: { userId: string }) {
  const profile = useMyProfile(userId);
  const { group } = useActiveGroup();
  const members = useGroupMembers(group.id).data ?? [];
  const setColor = useSetMyColor(userId);
  const queryClient = useQueryClient();
  const signOut = useSignOut();
  const disablePush = useDisablePush();

  return (
    <div className="flex flex-col gap-6">
      {profile.data && (
        <section className="flex flex-col gap-3">
          <h2 className="text-title-3 font-semibold">Deine Farbe</h2>
          <Card className="flex flex-col gap-3">
            <p className="text-footnote text-text-muted">
              Zeigt dich in Kalender, Graphen, Kommentaren und am Avatar. Farben aus deiner Gruppe
              sind vergeben.
            </p>
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
        </section>
      )}
      <TrainingSettings />
      <NotificationSettingsPanel />
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
  );
}
