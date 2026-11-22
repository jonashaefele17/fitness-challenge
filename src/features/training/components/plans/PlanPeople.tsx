import { Avatar } from '@/features/profile';
import { cn } from '@/shared/lib';
import { CheckIcon, ClockIcon, CloseIcon, QuestionIcon } from '@/shared/ui';
import { answerText, type PlanAnswer, type PlanPerson } from './social';

/** ✓ yes · ? maybe or open · clock another time · ✗ no */
export function PlanAnswerMark({ answer, className }: { answer: PlanAnswer; className?: string }) {
  const Icon =
    answer === 'accepted'
      ? CheckIcon
      : answer === 'proposed'
        ? ClockIcon
        : answer === 'declined'
          ? CloseIcon
          : QuestionIcon;
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-4 items-center justify-center rounded-pill text-caption',
        answer === 'accepted' && 'bg-accent text-on-accent',
        answer === 'declined' && 'bg-surface-3 text-text-subtle',
        answer !== 'accepted' && answer !== 'declined' && 'bg-surface-3 text-text',
        className,
      )}
    >
      <Icon className="size-3" />
    </span>
  );
}

/** Small avatars with their answer (the day sheet's right side). */
export function PlanPeopleAvatars({ people }: { people: PlanPerson[] }) {
  if (people.length === 0) return null;
  return (
    <span
      className="flex shrink-0 items-center -space-x-1.5"
      aria-label={people.map((p) => `${p.displayName} ${answerText(p.answer)}`).join(', ')}
    >
      {people.slice(0, 3).map((person) => (
        <span
          key={person.id}
          className={cn('relative', person.answer === 'declined' && 'opacity-40')}
        >
          <Avatar profile={person} size="sm" />
          <PlanAnswerMark answer={person.answer} className="absolute -right-0.5 -bottom-0.5" />
        </span>
      ))}
      {people.length > 3 && (
        <span className="pl-2.5 text-caption text-text-muted">+{people.length - 3}</span>
      )}
    </span>
  );
}
