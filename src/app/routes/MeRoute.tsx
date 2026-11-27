import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { motion } from 'motion/react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { useSignOut, useUserId } from '@/features/auth';
import { BodyOverview } from '@/features/body';
import { GoalsOverview, type Goal } from '@/features/goals';
import { groupKeys, useActiveGroup, useGroupMembers } from '@/features/groups';
import { HabitPauses, HabitsOverview } from '@/features/habits';
import {
  NotificationBell,
  NotificationSettingsPanel,
  useDisablePush,
} from '@/features/notifications';
import { Avatar, ColorPicker, useMyProfile, useSetMyColor } from '@/features/profile';
import {
  myGoalIds,
  SeasonBlock,
  seasonGoalFrame,
  useCurrentSeason,
  useSeasonGoalLinks,
} from '@/features/seasons';
import { MyExercises, TrainingSettings, useHomeStudio, usePlaces } from '@/features/training';
import { pressScale, spring } from '@/shared/design-tokens';
import { showToast } from '@/shared/lib';
import { Button, Card, ChevronLeftIcon, GearIcon, Screen, SegmentedControl } from '@/shared/ui';
import { GoalComments } from '../goals/GoalComments';
import { paths } from '../paths';
import { settingsPath, targetParams, useOpenTarget } from '../targets';

const roleLabels = { admin: 'Admin', member: 'Mitglied' } as const;

type Section = 'goals' | 'training' | 'habits' | 'body';

/**
 * "Wie entwickle ich mich?": my goals, training progress, habits and body; the settings
 * behind the gear (a pushed view, ?einstellungen=1, so "back" works as on the phone).
 */
export function MeRoute() {
  const userId = useUserId();
  const profile = useMyProfile(userId);
  const { group } = useActiveGroup();
  const homeId = useHomeStudio().data ?? null;
  const home = (usePlaces().data ?? []).find((place) => place.id === homeId);
  const [section, setSection] = useState<Section>('goals');
  const openTarget = useOpenTarget();
  const navigate = useNavigate();
  const location = useLocation();
  // Opened from the weigh reminder: Körper with the weigh-in open.
  const [params, setParams] = useSearchParams();
  const weigh = params.get(targetParams.weigh) === '1';
  // From Gruppe → Gewicht: Körper with "Sichtbarkeit" open.
  const sharing = params.get(targetParams.weightShare) === '1';
  // From the Zwischenstand reminder: Körper with the Zwischenstand open.
  const checkin = params.get(targetParams.bodyCheckin) === '1';
  if ((weigh || sharing || checkin) && section !== 'body') setSection('body');
  // From a season push, the feed or Heute: Ziele with the season (its setup while open).
  const seasonLink = params.get(targetParams.season);
  // From a correction push or a comment: Ziele with that goal open.
  const goalLink = params.get(targetParams.goal);
  if ((seasonLink || goalLink) && section !== 'goals') setSection('goals');
  // A comment notification also opens the goal's thread (kept past dropping the link).
  const [threadGoalId, setThreadGoalId] = useState<string | null>(null);
  if (goalLink && params.get(targetParams.thread) === '1' && threadGoalId !== goalLink) {
    setThreadGoalId(goalLink);
  }
  const dropLink = () => {
    setParams({}, { replace: true });
  };

  if (params.get(targetParams.settings) === '1') {
    return (
      <Screen
        title="Einstellungen"
        leading={
          <button
            type="button"
            onClick={() => {
              // Back to where the gear was tapped; opened directly: to Ich.
              if (location.key !== 'default') void navigate(-1);
              else void navigate(paths.me, { replace: true });
            }}
            className="-ml-2 flex min-h-tap items-center gap-1 rounded-pill px-2 text-body text-accent active:bg-surface-2"
          >
            <ChevronLeftIcon aria-hidden /> Ich
          </button>
        }
      >
        <Settings userId={userId} />
      </Screen>
    );
  }

  return (
    <Screen
      title="Ich"
      accessory={
        <div className="flex items-center gap-2">
          <motion.button
            type="button"
            aria-label="Einstellungen"
            whileTap={{ scale: pressScale }}
            transition={spring.press}
            onClick={() => void navigate(settingsPath())}
            className="flex size-tap items-center justify-center rounded-pill glass text-title-3"
          >
            <GearIcon />
          </motion.button>
          <NotificationBell onOpenTarget={openTarget} />
        </div>
      }
    >
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
            { value: 'goals', label: 'Ziele' },
            { value: 'training', label: 'Training' },
            { value: 'habits', label: 'Habits' },
            { value: 'body', label: 'Körper' },
          ]}
        />

        {section === 'goals' && (
          <GoalsWithSeason
            groupId={group.id}
            openSeasonId={seasonLink}
            openGoalId={goalLink}
            threadGoalId={threadGoalId}
            onLinkHandled={dropLink}
          />
        )}
        {section === 'training' && <MyExercises />}
        {section === 'habits' && <HabitsOverview />}
        {section === 'body' && (
          <BodyOverview
            openNew={weigh}
            openSharing={sharing}
            openCheckin={checkin}
            onOpened={() => {
              setParams({}, { replace: true });
            }}
          />
        )}
      </div>
    </Screen>
  );
}

/**
 * Ich → Ziele with the season composed in: the season block on top (pauses from habits,
 * comments on goals), and my goals marked as season goals – tagged, listed first, and
 * locked from the start.
 */
function GoalsWithSeason({
  groupId,
  openSeasonId,
  openGoalId,
  threadGoalId,
  onLinkHandled,
}: {
  groupId: string;
  openSeasonId: string | null;
  openGoalId: string | null;
  threadGoalId: string | null;
  onLinkHandled: () => void;
}) {
  const userId = useUserId();
  const season = useCurrentSeason().data ?? null;
  const links = useSeasonGoalLinks(season?.id ?? null).data ?? [];
  const mine = myGoalIds(links, userId);
  const frame = season ? seasonGoalFrame(season) : null;
  const comments = (goal: Goal) => (
    <GoalComments goal={goal} groupId={groupId} defaultOpen={goal.id === threadGoalId} />
  );
  return (
    <GoalsOverview
      header={
        <SeasonBlock
          pauses={<HabitPauses />}
          goalExtra={comments}
          openSeasonId={openSeasonId}
          onLinkHandled={onLinkHandled}
        />
      }
      frameOf={(goal) => (mine.has(goal.id) ? frame : null)}
      detailFooter={(goal) => (mine.has(goal.id) ? comments(goal) : null)}
      openGoalId={openGoalId}
      onGoalOpened={onLinkHandled}
    />
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
