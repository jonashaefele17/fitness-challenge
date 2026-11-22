import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useUserId } from '@/features/auth';
import { useActiveGroup, useGroupMembers } from '@/features/groups';
import { Avatar } from '@/features/profile';
import { TrainingTypeIcon, useActiveWorkout } from '@/features/training';
import { Button } from '@/shared/ui';
import { liveKeys, useLiveStart, useLiveToday } from '../api/useLive';

function todayKey(): string {
  const now = new Date();
  return `${String(now.getFullYear())}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * "Heute mit anderen": today's plan dates of others I take part in. "Mitmachen" while
 * someone trains it, otherwise "Starten" (the others join me then).
 */
export function LiveTodayList({ onStarted }: { onStarted: () => void }) {
  const [today] = useState(todayKey);
  // A date I trained already (and finished) is gone; one I train right now says so.
  const activeId = useActiveWorkout().data?.id ?? null;
  const dates = (useLiveToday(today).data ?? []).filter(
    (d) => d.myWorkoutId === null || d.myWorkoutId === activeId,
  );
  const { group } = useActiveGroup();
  const members = useGroupMembers(group.id).data ?? [];
  const start = useLiveStart();
  // A workout started for me (or ended): the list is re-read.
  const userId = useUserId();
  const queryClient = useQueryClient();
  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: liveKeys.today(userId, today) });
  }, [activeId, queryClient, userId, today]);
  if (dates.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-footnote font-semibold text-text-muted">Heute mit anderen</h2>
      <ul className="flex flex-col gap-2">
        {dates.map((date) => {
          const owner = members.find((m) => m.userId === date.ownerId);
          const training = date.memberIds.flatMap(
            (id) => members.find((m) => m.userId === id) ?? [],
          );
          return (
            <li
              key={`${date.planId}:${date.planOn}`}
              className="flex min-h-tap items-center gap-3 rounded-card bg-surface-2 px-4 py-3"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-surface-3 text-accent">
                <TrainingTypeIcon icon={date.typeIcon} className="size-5" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-subhead font-semibold">
                  {[date.typeName, date.focusName].filter(Boolean).join(' · ')}
                </span>
                <span className="truncate text-footnote text-text-muted">
                  {date.myWorkoutId
                    ? 'Läuft gerade'
                    : date.running
                      ? `${training.map((m) => m.displayName).join(', ')} trainiert gerade`
                      : [
                          owner ? `mit ${owner.displayName}` : null,
                          date.startTime && `${date.startTime} Uhr`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                </span>
              </span>
              {date.running && (
                <span className="flex -space-x-1.5">
                  {training.slice(0, 2).map((m) => (
                    <Avatar key={m.userId} profile={m} size="sm" />
                  ))}
                </span>
              )}
              <Button
                loading={start.isPending && start.variables.planId === date.planId}
                onClick={() => {
                  if (date.myWorkoutId) {
                    onStarted();
                    return;
                  }
                  start.mutate(
                    { planId: date.planId, planOn: date.planOn },
                    { onSuccess: onStarted },
                  );
                }}
              >
                {date.myWorkoutId ? 'Öffnen' : date.running ? 'Mitmachen' : 'Starten'}
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
