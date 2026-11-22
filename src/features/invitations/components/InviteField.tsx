import { useUserId } from '@/features/auth';
import { useActiveGroup, useGroupMembers } from '@/features/groups';
import { Avatar } from '@/features/profile';
import { cn } from '@/shared/lib';
import { FieldGroup } from '@/shared/ui';

/** "Mit wem?": the others of the group as avatars to tap on and off. */
export function InviteField({
  value,
  onChange,
}: {
  value: string[];
  onChange: (userIds: string[]) => void;
}) {
  const userId = useUserId();
  const { group } = useActiveGroup();
  const others = (useGroupMembers(group.id).data ?? []).filter((m) => m.userId !== userId);
  if (others.length === 0) return null;

  return (
    <FieldGroup label="Mit wem? (optional)">
      <div className="-mx-gutter no-scrollbar flex gap-3 overflow-x-auto px-gutter">
        {others.map((member) => {
          const chosen = value.includes(member.userId);
          return (
            <button
              key={member.userId}
              type="button"
              aria-pressed={chosen}
              onClick={() => {
                onChange(
                  chosen ? value.filter((id) => id !== member.userId) : [...value, member.userId],
                );
              }}
              className="flex min-h-tap w-16 shrink-0 flex-col items-center gap-1 rounded-card py-1 active:bg-surface-2"
            >
              <Avatar
                profile={member}
                className={cn('transition-opacity', !chosen && 'opacity-40')}
              />
              <span
                className={cn(
                  'max-w-full truncate text-caption',
                  chosen ? 'font-semibold text-text' : 'text-text-muted',
                )}
              >
                {member.displayName}
              </span>
            </button>
          );
        })}
      </div>
    </FieldGroup>
  );
}
