import { useGroupMembers } from '@/features/groups';
import { Avatar } from '@/features/profile';
import { cn } from '@/shared/lib';
import { useTrainedToday } from '../api/useFeed';

/** The group at a glance: everyone's avatar, lit up when they trained today. */
export function TrainedToday({ groupId }: { groupId: string }) {
  const members = useGroupMembers(groupId).data ?? [];
  const trained = useTrainedToday(groupId).data ?? [];
  if (members.length < 2) return null;
  return (
    <section aria-label="Heute trainiert" className="flex flex-col gap-2">
      <h2 className="text-footnote font-semibold text-text-muted">Heute</h2>
      <ul className="-mx-gutter no-scrollbar flex gap-4 overflow-x-auto px-gutter">
        {members.map((member) => {
          const done = trained.includes(member.userId);
          return (
            <li key={member.userId} className="flex w-14 shrink-0 flex-col items-center gap-1">
              <span
                className={cn(
                  'relative transition-opacity duration-(--duration-base)',
                  !done && 'opacity-40',
                )}
              >
                <Avatar profile={member} />
                {done && (
                  <span
                    aria-hidden
                    className="absolute -right-0.5 -bottom-0.5 flex size-5 items-center justify-center rounded-pill bg-accent text-caption font-bold text-on-accent"
                  >
                    ✓
                  </span>
                )}
              </span>
              <span className="w-full truncate text-center text-caption text-text-muted">
                {member.displayName}
              </span>
              <span className="sr-only">{done ? 'hat heute trainiert' : 'noch nicht'}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
