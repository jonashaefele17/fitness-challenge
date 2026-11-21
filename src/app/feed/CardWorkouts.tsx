import type { FeedCard } from '@/features/feed';
import { useMemberLookup } from '@/features/groups';
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
  const member = useMemberLookup(card.groupId)(card.actorId);
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
        </li>
      ))}
    </ul>
  );
}
