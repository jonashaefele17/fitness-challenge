import { personColorVar } from '@/shared/design-tokens';
import { cn } from '@/shared/lib';
import { companions, type PlanPerson } from '../plans/social';
import type { CalendarWorkout, PlanOccurrence } from '../../types';
import { TrainingTypeIcon } from '../TrainingTypeIcon';
import { cellLabel } from './workoutText';

/**
 * What happened on a day, in the person's colour (set on the parent):
 * - done: the filled icon (strength first), a small second one, "+n" beyond two, and a
 *   quiet grey label (focus short name, distance or duration)
 * - planned (nothing done yet): the outline icon, faded, with the time (a star for an event)
 * - cancelled: grey; in the group view (`tinted`) with a hint of the person's colour
 */
export function DayMarks({
  workouts,
  plans = [],
  tinted = false,
  personId,
  peopleOf,
  dots = false,
}: {
  workouts: CalendarWorkout[];
  plans?: PlanOccurrence[] | undefined;
  /** Group view: cancelled keeps a hint of the row's colour. */
  tinted?: boolean;
  /** Whose marks these are (to fade dates they have not said yes to). */
  personId?: string;
  /** Who takes part in a date (from the social slot). */
  peopleOf?: (plan: PlanOccurrence) => PlanPerson[];
  /** My view: a dot for who comes along (filled = yes, ring = open, "+n" for more). */
  dots?: boolean;
}) {
  const [first, second] = workouts;
  if (!first) {
    const plan =
      plans.find((p) => p.status === 'planned') ?? plans.find((p) => p.status === 'cancelled');
    if (!plan) return null;
    const cancelled = plan.status === 'cancelled';
    const people = peopleOf?.(plan) ?? [];
    // Someone else's date this person has not said yes to yet: paler still.
    const pending =
      personId !== undefined &&
      plan.userId !== personId &&
      people.find((p) => p.id === personId)?.answer !== 'accepted';
    const along = dots && personId ? companions(people, personId) : [];
    const [firstAlong] = along;
    return (
      <span
        className={cn(
          'flex min-w-0 flex-col items-center gap-0.5',
          cancelled && !tinted && 'text-text-subtle',
          cancelled &&
            tinted &&
            'text-[color-mix(in_oklab,currentColor_22%,var(--color-text-subtle))]',
        )}
      >
        <span className="relative flex">
          <span className={cn('flex', !cancelled && (pending ? 'opacity-30' : 'opacity-55'))}>
            {plan.kind === 'event' ? (
              <span aria-hidden className="text-subhead leading-none">
                ★
              </span>
            ) : (
              <TrainingTypeIcon icon={plan.trainingType?.icon ?? 'generic'} className="size-5" />
            )}
          </span>
          {firstAlong && !cancelled && (
            <span aria-hidden className="absolute -top-1 -right-2 flex items-center gap-px">
              <span
                className="size-2 rounded-pill border-[1.5px] border-solid"
                style={{
                  borderColor: personColorVar(firstAlong.color),
                  backgroundColor:
                    firstAlong.answer === 'accepted' ? personColorVar(firstAlong.color) : undefined,
                }}
              />
              {along.length > 1 && (
                <span className="text-caption leading-none text-text-muted">
                  +{along.length - 1}
                </span>
              )}
            </span>
          )}
        </span>
        <span
          className={cn(
            'max-w-full truncate text-caption leading-none text-text-muted',
            !cancelled && 'opacity-55',
          )}
        >
          {cancelled ? '' : (plan.focus?.shortName ?? plan.startTime ?? '')}
        </span>
      </span>
    );
  }
  const label = cellLabel(first) || (workouts.length > 1 ? `${String(workouts.length)}×` : '');
  return (
    <span className="flex min-w-0 flex-col items-center gap-0.5">
      <span className="flex items-center gap-0.5">
        <TrainingTypeIcon
          icon={first.trainingType.icon}
          variant="filled"
          className={second ? 'size-4' : 'size-5'}
        />
        {second && (
          <TrainingTypeIcon
            icon={second.trainingType.icon}
            variant="filled"
            className="size-3 opacity-70"
          />
        )}
        {workouts.length > 2 && (
          <span className="text-caption leading-none">+{workouts.length - 2}</span>
        )}
      </span>
      <span className="max-w-full truncate text-caption leading-none text-text-muted">{label}</span>
    </span>
  );
}
