import { useState, type ReactNode } from 'react';
import { useUserId } from '@/features/auth';
import {
  formatGoalDay,
  goalTitle,
  goalTodayKey,
  GoalDetailSheet,
  GoalProgressBar,
  GoalStatusLine,
  GoalValues,
  type Goal,
} from '@/features/goals';
import { useActiveGroup, useGroupMembers, type GroupMember } from '@/features/groups';
import { Avatar } from '@/features/profile';
import { showToast } from '@/shared/lib';
import { Button, CheckIcon, ChevronRightIcon, FieldGroup, PlusIcon, Sheet } from '@/shared/ui';
import {
  useAddSeasonParticipant,
  useRemoveSeasonParticipant,
  useSeasonGoals,
  useSeasonParticipants,
} from '../api/useSeasons';
import { missingMetricsText, seasonErrorText } from '../format';
import { seasonGoalFrame, seasonStarted } from '../setup';
import type { Season, SeasonParticipant } from '../types';
import { GoalCorrectionSheet } from './GoalCorrectionSheet';

/**
 * Everyone in the season: their setup state and their season goals (progress and status;
 * kg / cm only as far as each person shares them). A goal opens its detail read-only, with
 * the app's slot (comments) and – for group admins on a locked goal – "Korrigieren". Admins
 * also add and remove participants here.
 */
export function SeasonParticipantsSheet({
  season,
  open,
  onOpenChange,
  metricLabel,
  goalExtra,
}: {
  season: Season;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metricLabel: (key: string) => string;
  /** Under a goal's figures in its detail (e.g. its comments), from the app. */
  goalExtra?: (goal: Goal) => ReactNode;
}) {
  const userId = useUserId();
  const { group } = useActiveGroup();
  const isAdmin = group.role === 'admin';
  const members = useGroupMembers(group.id).data ?? [];
  const participants = useSeasonParticipants(open ? season.id : null);
  const goals = useSeasonGoals(open ? season.id : null);
  const add = useAddSeasonParticipant();
  const remove = useRemoveSeasonParticipant();
  const [today] = useState(goalTodayKey);
  const [shown, setShown] = useState<{ goal: Goal; owner: SeasonParticipant } | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [correctOpen, setCorrectOpen] = useState(false);
  const [removing, setRemoving] = useState<GroupMember | null>(null);

  const memberOf = (id: string) => members.find((m) => m.userId === id);
  const list = participants.data ?? [];
  const others = members.filter((m) => !list.some((p) => p.userId === m.userId));
  const started = seasonStarted(season);
  const live = season.phase !== 'cancelled' && season.phase !== 'ended';
  // The detail shows the goal as it is now in the cache (after a correction too).
  const shownGoal = shown
    ? (goals.data
        ?.find((p) => p.userId === shown.owner.userId)
        ?.goals.find((g) => g.id === shown.goal.id) ?? shown.goal)
    : null;

  const refused = (fallback: string) => (e: unknown) => {
    showToast(seasonErrorText(e) ?? fallback);
  };

  function addMember(member: GroupMember) {
    add.mutate(
      { seasonId: season.id, userId: member.userId },
      { onError: refused('Konnte nicht hinzugefügt werden.') },
    );
    showToast(`${member.displayName} ist dabei`, {
      label: 'Rückgängig',
      onAction: () => {
        remove.mutate({ seasonId: season.id, userId: member.userId });
      },
    });
  }

  function confirmRemove() {
    if (!removing) return;
    remove.mutate(
      { seasonId: season.id, userId: removing.userId },
      { onError: refused('Konnte nicht entfernt werden.') },
    );
    showToast(`${removing.displayName} ist nicht mehr dabei`);
    setRemoving(null);
  }

  const shownOwner = shown ? memberOf(shown.owner.userId) : undefined;
  const correctable = isAdmin && shown !== null && shownGoal !== null && shown.owner.locked && live;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange} title="Teilnehmer">
        <div className="flex flex-col gap-5 pt-1">
          {list.map((p) => {
            const member = memberOf(p.userId);
            const personGoals = goals.data?.find((g) => g.userId === p.userId)?.goals ?? [];
            return (
              <section key={p.userId} className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  {member && <Avatar profile={member} size="sm" />}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-body font-semibold">
                      {p.userId === userId ? 'Du' : (member?.displayName ?? 'Jemand')}
                    </span>
                    <span className="flex items-center gap-1 text-footnote text-text-muted">
                      {p.readyAt !== null && (
                        <CheckIcon aria-hidden className="size-3.5 text-accent" strokeWidth={3} />
                      )}
                      {participantState(p, season, metricLabel, today)}
                    </span>
                  </div>
                  {isAdmin && live && p.userId !== userId && member && (
                    <button
                      type="button"
                      onClick={() => {
                        setRemoving(member);
                      }}
                      className="min-h-tap shrink-0 rounded-pill px-3 text-subhead text-text-muted active:bg-surface-2"
                    >
                      Entfernen
                    </button>
                  )}
                </div>
                {personGoals.length > 0 && (
                  <ul className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
                    {personGoals.map((goal) => (
                      <li key={goal.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setShown({ goal, owner: p });
                            setDetailOpen(true);
                          }}
                          className="flex min-h-tap w-full items-center gap-3 px-4 py-2.5 text-left active:bg-surface-3"
                        >
                          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                            <span className="truncate text-subhead">{goalTitle(goal)}</span>
                            <GoalProgressBar goal={goal} />
                            {goal.phase === 'upcoming' ? (
                              goal.valuesHidden ? (
                                <span className="text-footnote text-text-muted">
                                  Werte nicht geteilt
                                </span>
                              ) : (
                                <GoalValues goal={goal} className="text-footnote" />
                              )
                            ) : (
                              <GoalStatusLine
                                status={goal.status}
                                onTrack={goal.onTrack}
                                phase={goal.phase}
                                averaged={goal.metric === 'trainings_per_week'}
                              />
                            )}
                          </span>
                          <ChevronRightIcon aria-hidden className="shrink-0 text-text-subtle" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}

          {isAdmin && live && others.length > 0 && (
            <FieldGroup label="Hinzufügen">
              <ul className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
                {others.map((member) => (
                  <li key={member.userId}>
                    <button
                      type="button"
                      onClick={() => {
                        addMember(member);
                      }}
                      className="flex min-h-tap w-full items-center gap-3 px-4 py-2 text-left active:bg-surface-3"
                    >
                      <Avatar profile={member} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-body">
                        {member.displayName}
                      </span>
                      <PlusIcon aria-hidden className="shrink-0 text-accent" />
                    </button>
                  </li>
                ))}
              </ul>
              {started && (
                <p className="text-footnote text-text-muted">
                  Die Saison läuft schon: Wer jetzt dazukommt, startet ab heute und richtet seine
                  Ziele selbst ein.
                </p>
              )}
            </FieldGroup>
          )}
        </div>
        <GoalDetailSheet
          goal={shownGoal}
          open={detailOpen}
          onOpenChange={setDetailOpen}
          readOnly={shown?.owner.userId !== userId}
          frame={shown?.owner.userId === userId ? seasonGoalFrame(season) : null}
          footer={
            shownGoal && (
              <>
                {goalExtra?.(shownGoal)}
                {correctable &&
                  (shownGoal.valuesHidden ? (
                    <div className="flex flex-col gap-1">
                      <Button variant="tinted" fullWidth disabled>
                        Korrigieren
                      </Button>
                      <p className="text-center text-footnote text-text-muted">
                        Werte sind nicht geteilt.
                      </p>
                    </div>
                  ) : (
                    <Button
                      variant="tinted"
                      fullWidth
                      onClick={() => {
                        setCorrectOpen(true);
                      }}
                    >
                      Korrigieren
                    </Button>
                  ))}
                <GoalCorrectionSheet
                  goal={shownGoal}
                  ownerName={shownOwner?.displayName ?? 'Jemand'}
                  open={correctOpen && detailOpen}
                  onOpenChange={setCorrectOpen}
                />
              </>
            )
          }
        />

        <Sheet
          open={removing !== null}
          onOpenChange={(next) => {
            if (!next) setRemoving(null);
          }}
          title={`${removing?.displayName ?? 'Person'} entfernen?`}
          description="Die Saisonziele werden wieder normale Ziele. Hinzufügen geht später wieder, die Einrichtung beginnt dann neu."
        >
          <div className="flex flex-col gap-2">
            <Button variant="danger" fullWidth onClick={confirmRemove}>
              Entfernen
            </Button>
            <Button
              variant="ghost"
              fullWidth
              onClick={() => {
                setRemoving(null);
              }}
            >
              Abbrechen
            </Button>
          </div>
        </Sheet>
      </Sheet>
    </>
  );
}

function participantState(
  p: SeasonParticipant,
  season: Season,
  metricLabel: (key: string) => string,
  today: string,
): string {
  if (p.readyAt !== null) return p.locked && seasonStarted(season) ? 'Festgeschrieben' : 'Bereit';
  if (p.lateEntry) return `Später Einstieg ab ${formatGoalDay(p.startsOn, today)} · richtet ein`;
  if (p.locked) return 'Festgeschrieben, ohne „Bereit“';
  return missingMetricsText(p.missingMetrics, metricLabel) ?? 'Noch nicht bereit';
}
