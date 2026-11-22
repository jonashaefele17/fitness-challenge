import { useActiveGroup, useGroupMembers, type GroupMember } from '@/features/groups';
import { Avatar } from '@/features/profile';
import { TrainingTypeIcon } from '@/features/training';
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

function People({ people }: { people: GroupMember[] }) {
  if (people.length === 0) return null;
  return (
    <span className="flex shrink-0 -space-x-1.5">
      {people.slice(0, 2).map((m) => (
        <Avatar key={m.userId} profile={m} size="sm" />
      ))}
    </span>
  );
}

/** A date of someone else as the main entry of Heute's card: big title, compact start. */
export function LiveDateMain({ date, onStarted }: { date: LiveToday; onStarted: () => void }) {
  const d = useDate(date, onStarted);
  return (
    <>
      <div className="flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-pill bg-surface-3 text-accent">
          <TrainingTypeIcon icon={date.typeIcon} className="size-6" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-title-3 font-bold">
            {[date.typeName, date.focusName].filter(Boolean).join(' · ')}
          </span>
          <span className="truncate text-subhead text-text-muted">{d.subtitle}</span>
        </span>
        <Button loading={d.loading} onClick={d.go}>
          {d.label}
        </Button>
      </div>
    </>
  );
}

/** A further date of someone else today: one compact row with its own button. */
export function LiveDateRow({ date, onStarted }: { date: LiveToday; onStarted: () => void }) {
  const d = useDate(date, onStarted);
  return (
    <div className="flex min-h-tap items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-surface-3 text-accent">
        <TrainingTypeIcon icon={date.typeIcon} className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-subhead font-semibold">
          {[date.typeName, date.focusName].filter(Boolean).join(' · ')}
        </span>
        <span className="truncate text-footnote text-text-muted">{d.subtitle}</span>
      </span>
      {date.running && <People people={d.training} />}
      <Button variant="tinted" loading={d.loading} onClick={d.go}>
        {d.label}
      </Button>
    </div>
  );
}
