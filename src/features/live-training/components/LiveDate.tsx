import { useActiveGroup, useGroupMembers } from '@/features/groups';
import { Button } from '@/shared/ui';
import { useLiveStart } from '../api/useLive';
import type { LiveToday } from '../types';

/** What a date says below its title and what its button does. */
function useDate(date: LiveToday, onStarted: () => void) {
  const { group } = useActiveGroup();
  const members = useGroupMembers(group.id).data ?? [];
  const start = useLiveStart();
  const owner = members.find((m) => m.userId === date.ownerId);
  const training = date.memberIds.flatMap((id) => members.find((m) => m.userId === id) ?? []);
  const subtitle = date.myWorkoutId
    ? 'Läuft gerade'
    : date.running
      ? `${training.map((m) => m.displayName).join(', ')} trainiert gerade`
      : [date.startTime && `${date.startTime} Uhr`, owner ? `mit ${owner.displayName}` : null]
          .filter(Boolean)
          .join(' · ');
  return {
    owner,
    training,
    subtitle,
    label: date.myWorkoutId ? 'Öffnen' : date.running ? 'Mitmachen' : 'Starten',
    loading: start.isPending && start.variables.planId === date.planId,
    go: () => {
      if (date.myWorkoutId) {
        onStarted();
        return;
      }
      start.mutate({ planId: date.planId, planOn: date.planOn }, { onSuccess: onStarted });
    },
  };
}

/** The start button of a date of someone else: start, join (someone trains) or open. */
export function LiveDateButton({
  date,
  onStarted,
  variant = 'primary',
}: {
  date: LiveToday;
  onStarted: () => void;
  variant?: 'primary' | 'tinted';
}) {
  const d = useDate(date, onStarted);
  return (
    <Button variant={variant} loading={d.loading} onClick={d.go}>
      {d.label}
    </Button>
  );
}
