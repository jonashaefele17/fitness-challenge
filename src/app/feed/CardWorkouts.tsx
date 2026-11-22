import type { FeedCard } from '@/features/feed';
import { useMemberLookup } from '@/features/groups';
import { useTrainedAlong } from '@/features/live-training';
import { useWorkoutSummaries, WorkoutSummaryRow } from '@/features/training';
import { personColorVar } from '@/shared/design-tokens';

/** The workouts on a day card (feed card body), each opening its detail. */
export function CardWorkouts({
  card,
  onOpen,
}: {
  card: FeedCard;
  onOpen: (workoutId: string) => void;
}) {
  const ids = card.events.flatMap((event) =>
    event.type === 'workout_finished' && event.targetId ? [event.targetId] : [],
  );
  const workouts = useWorkoutSummaries(ids).data ?? [];
  const lookup = useMemberLookup(card.groupId);
  const member = lookup(card.actorId);
  // Trained together: "mit Grazon" under the workout.
  const along = useTrainedAlong(ids).data;
  const color = member ? personColorVar(member.color) : 'var(--color-accent)';
  if (ids.length === 0) return null;
  return (
    <ul className="flex flex-col gap-2">
      {workouts.map((workout) => (
        <li key={workout.id}>
          <WorkoutSummaryRow
            workout={workout}
            color={color}
            onOpen={() => {
              onOpen(workout.id);
            }}
          />
          {(along?.get(workout.id) ?? []).length > 0 && (
            <p className="px-1 pt-1 text-footnote text-text-muted">
              mit{' '}
              {(along?.get(workout.id) ?? [])
                .flatMap((id) => lookup(id)?.displayName ?? [])
                .join(', ')}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
