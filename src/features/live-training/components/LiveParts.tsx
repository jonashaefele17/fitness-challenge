import { useActiveGroup, useGroupMembers, type GroupMember } from '@/features/groups';
import { Avatar } from '@/features/profile';
import { formatSet } from '@/features/training';
import { personColorVar } from '@/shared/design-tokens';
import { cn } from '@/shared/lib';
import { useLiveChannel, useLiveSession, useLiveSync, usePeerSets } from '../api/useLive';
import type { PeerSets } from '../types';

function useMember() {
  const { group } = useActiveGroup();
  const members = useGroupMembers(group.id).data ?? [];
  return (id: string): GroupMember | undefined => members.find((m) => m.userId === id);
}

/**
 * Slot under the timer: "mit Grazon" (done ones faded). While it is shown it also listens
 * to the session and keeps my exercises in step with what the others add, remove and move.
 */
export function TrainingAlong({ workoutId }: { workoutId: string }) {
  useLiveSync(workoutId);
  const session = useLiveSession(workoutId).data;
  useLiveChannel(session?.sessionId ?? null);
  const member = useMember();
  const others = (session?.others ?? []).flatMap((o) => {
    const m = member(o.userId);
    return m ? [{ ...m, training: o.training }] : [];
  });
  if (others.length === 0) return null;
  return (
    <span className="flex max-w-full items-center gap-1 truncate text-caption text-text-muted">
      mit{' '}
      {others.map((o, index) => (
        <span key={o.userId} className={cn('font-semibold', !o.training && 'opacity-50')}>
          <span style={{ color: personColorVar(o.color) }}>{o.displayName}</span>
          {index < others.length - 1 ? ', ' : ''}
        </span>
      ))}
    </span>
  );
}

function measureOf(set: PeerSets['sets'][number]) {
  return set.durationSeconds !== null
    ? ('duration' as const)
    : set.weightKg !== null
      ? ('weight_reps' as const)
      : ('reps' as const);
}

/** Slot over the exercise card: the others' done sets of this exercise, live. */
export function PeerSetsRow({ workoutId, itemId }: { workoutId: string; itemId: string }) {
  const peers = (usePeerSets(workoutId).data ?? []).filter((p) => p.itemId === itemId);
  const member = useMember();
  if (peers.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1.5 rounded-card bg-surface-2 px-4 py-2.5">
      {peers.map((peer) => {
        const person = member(peer.userId);
        if (!person) return null;
        return (
          <li key={peer.userId} className="flex min-w-0 items-center gap-2">
            <Avatar profile={person} size="sm" className="size-6 text-caption" />
            <span className="min-w-0 truncate text-footnote text-text-muted tabular-nums">
              {peer.sets.length === 0
                ? 'noch kein Satz'
                : peer.sets
                    .map((set) => `${set.isWarmup ? 'W ' : ''}${formatSet(measureOf(set), set)}`)
                    .join(' · ')}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
