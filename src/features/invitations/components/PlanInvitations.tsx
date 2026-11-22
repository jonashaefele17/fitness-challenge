import { useState, type ReactNode } from 'react';
import { useUserId } from '@/features/auth';
import { useActiveGroup, useGroupMembers, type GroupMember } from '@/features/groups';
import { Avatar } from '@/features/profile';
import { answerText, PlanAnswerMark, type PlanOccurrence } from '@/features/training';
import { cn } from '@/shared/lib';
import { Button, SegmentedControl, Sheet, TextField } from '@/shared/ui';
import {
  useAcceptProposal,
  useAnswerRequest,
  useRequestJoin,
  useRespond,
  useSetParticipants,
} from '../api/useInvitationActions';
import { answerFor, useParticipation } from '../api/useParticipation';
import type { Answer, Participant } from '../types';
import { InviteField } from './InviteField';

const shortDate = new Intl.DateTimeFormat('de', {
  weekday: 'short',
  day: 'numeric',
  month: 'numeric',
});

function proposalText(date: string, time: string | null): string {
  return `${shortDate.format(new Date(`${date}T12:00:00`))}${time ? ` · ${time}` : ''}`;
}

const answers: { value: Answer; label: string }[] = [
  { value: 'accepted', label: 'Zusage' },
  { value: 'maybe', label: 'Vielleicht' },
  { value: 'declined', label: 'Absage' },
];

/**
 * Who takes part in a plan date, in its detail:
 * - owner: everyone's answer, take a proposal, let someone come along, invite people
 * - invited: answer (this date or, for a series, all dates), propose another time
 * - anyone else in the group: "Ich komm mit"
 */
export function PlanInvitations({ plan }: { plan: PlanOccurrence }) {
  const userId = useUserId();
  const { group } = useActiveGroup();
  const members = useGroupMembers(group.id).data ?? [];
  const participation = useParticipation([plan.planId]);
  const data = participation.data;
  if (!data) return null;

  const participants = data.participants.filter((p) => p.planId === plan.planId);
  const member = (id: string) => members.find((m) => m.userId === id);
  const mine = plan.userId === userId;
  const me = participants.find((p) => p.userId === userId);
  const owner = member(plan.userId);
  const taking = participants.filter((p) => p.status !== 'requested');

  return (
    <section className="flex flex-col gap-3">
      {(taking.length > 0 || mine) && (
        <ul className="flex flex-col divide-y divide-border rounded-card bg-surface-2">
          {!mine && owner && <PersonRow member={owner} text="plant den Termin" answer="accepted" />}
          {taking
            .filter((p) => p.userId !== userId || mine)
            .map((p) => {
              const person = member(p.userId);
              if (!person) return null;
              const answer = answerFor(data, plan, p);
              const proposal = data.responses.find(
                (r) =>
                  r.planId === plan.planId &&
                  r.userId === p.userId &&
                  r.onDate === plan.planDate &&
                  r.status === 'proposed',
              );
              return (
                <PersonRow
                  key={p.userId}
                  member={person}
                  answer={answer}
                  text={
                    proposal?.proposedDate
                      ? `schlägt ${proposalText(proposal.proposedDate, proposal.proposedTime)} vor`
                      : answerText(answer)
                  }
                >
                  {mine && proposal && <TakeProposal plan={plan} userId={p.userId} />}
                </PersonRow>
              );
            })}
          {mine &&
            participants
              .filter((p) => p.status === 'requested')
              .map((p) => {
                const person = member(p.userId);
                return person ? (
                  <JoinRequestRow key={p.userId} plan={plan} member={person} />
                ) : null;
              })}
          {mine && taking.length === 0 && (
            <li className="px-4 py-3 text-subhead text-text-muted">Noch niemand eingeladen.</li>
          )}
        </ul>
      )}

      {mine && plan.status === 'planned' && (
        <InviteButton plan={plan} participants={participants} />
      )}
      {!mine && me && me.status !== 'requested' && plan.status === 'planned' && (
        <MyAnswer plan={plan} me={me} ownerName={owner?.displayName ?? 'Die Person'} />
      )}
      {!mine && me?.status === 'requested' && (
        <p className="text-subhead text-text-muted">
          Angefragt. {owner?.displayName ?? 'Die Person'} entscheidet, ob du mitkommst.
        </p>
      )}
      {!mine && !me && plan.status === 'planned' && <JoinButton plan={plan} />}
    </section>
  );
}

function PersonRow({
  member,
  answer,
  text,
  children,
}: {
  member: GroupMember;
  answer: ReturnType<typeof answerFor>;
  text: string;
  children?: ReactNode;
}) {
  return (
    <li className="flex min-h-tap items-center gap-3 px-4 py-2.5">
      <span className={cn('relative', answer === 'declined' && 'opacity-40')}>
        <Avatar profile={member} size="sm" />
        <PlanAnswerMark answer={answer} className="absolute -right-0.5 -bottom-0.5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-subhead font-semibold">{member.displayName}</span>
        <span className="truncate text-footnote text-text-muted">{text}</span>
      </span>
      {children}
    </li>
  );
}

function TakeProposal({ plan, userId }: { plan: PlanOccurrence; userId: string }) {
  const accept = useAcceptProposal();
  return (
    <Button
      variant="secondary"
      loading={accept.isPending}
      onClick={() => {
        accept.mutate({ planId: plan.planId, userId, planDate: plan.planDate });
      }}
    >
      Übernehmen
    </Button>
  );
}

function JoinRequestRow({ plan, member }: { plan: PlanOccurrence; member: GroupMember }) {
  const answer = useAnswerRequest();
  return (
    <li className="flex flex-col gap-2 px-4 py-2.5">
      <span className="flex items-center gap-3">
        <Avatar profile={member} size="sm" />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-subhead font-semibold">{member.displayName}</span>
          <span className="text-footnote text-text-muted">möchte mitkommen</span>
        </span>
      </span>
      <span className="grid grid-cols-2 gap-2">
        <Button
          loading={answer.isPending && answer.variables.accept}
          onClick={() => {
            answer.mutate({ planId: plan.planId, userId: member.userId, accept: true });
          }}
        >
          Mitnehmen
        </Button>
        <Button
          variant="secondary"
          loading={answer.isPending && !answer.variables.accept}
          onClick={() => {
            answer.mutate({ planId: plan.planId, userId: member.userId, accept: false });
          }}
        >
          Lieber nicht
        </Button>
      </span>
    </li>
  );
}

function InviteButton({
  plan,
  participants,
}: {
  plan: PlanOccurrence;
  participants: Participant[];
}) {
  const invited = participants.filter((p) => p.status !== 'requested').map((p) => p.userId);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(invited);
  const save = useSetParticipants();
  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          setValue(invited);
          setOpen(true);
        }}
      >
        {invited.length > 0 ? 'Einladung ändern' : 'Leute einladen'}
      </Button>
      <Sheet open={open} onOpenChange={setOpen} title="Einladen">
        <div className="flex flex-col gap-6 pt-1">
          <InviteField value={value} onChange={setValue} />
          {plan.recurring && (
            <p className="text-footnote text-text-muted">Die Einladung gilt für alle Termine.</p>
          )}
          {save.isError && (
            <p role="alert" className="text-footnote text-danger">
              Speichern hat nicht geklappt.
            </p>
          )}
          <Button
            size="lg"
            loading={save.isPending}
            onClick={() => {
              save.mutate(
                { planId: plan.planId, userIds: value },
                {
                  onSuccess: () => {
                    setOpen(false);
                  },
                },
              );
            }}
          >
            Speichern
          </Button>
        </div>
      </Sheet>
    </>
  );
}

function MyAnswer({
  plan,
  me,
  ownerName,
}: {
  plan: PlanOccurrence;
  me: Participant;
  ownerName: string;
}) {
  const data = useParticipation([plan.planId]).data;
  // My proposal of another time for this date, if any.
  const proposal = data?.responses.find(
    (r) =>
      r.planId === plan.planId &&
      r.userId === me.userId &&
      r.onDate === plan.planDate &&
      r.status === 'proposed',
  );
  // A series not answered yet: the answer holds for all dates, unless chosen otherwise
  // (with a proposal for this date, this date is what counts).
  const [scope, setScope] = useState<'one' | 'all'>(
    plan.recurring && me.status === 'invited' && !proposal ? 'all' : 'one',
  );
  const [proposing, setProposing] = useState(false);
  const respond = useRespond();
  const current = data ? answerFor(data, plan, me) : 'open';
  const shown = scope === 'all' ? (me.status === 'invited' ? 'open' : me.status) : current;

  function answer(status: Answer) {
    respond.mutate({
      planId: plan.planId,
      planDate: plan.recurring && scope === 'all' ? null : plan.planDate,
      status,
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {proposal?.proposedDate && (
        <div className="flex items-start gap-3 rounded-card bg-surface-2 px-4 py-3">
          <PlanAnswerMark answer="proposed" className="mt-0.5 size-5" />
          <span className="flex min-w-0 flex-col">
            <span className="text-subhead font-semibold">
              Dein Vorschlag: {proposalText(proposal.proposedDate, proposal.proposedTime)}
            </span>
            <span className="text-footnote text-text-muted">
              {ownerName} kann ihn mit einem Tap übernehmen. Mit Zusage, Vielleicht oder Absage für
              diesen Termin ziehst du ihn zurück.
            </span>
          </span>
        </div>
      )}
      {plan.recurring && (
        <SegmentedControl
          label="Antwort gilt für"
          size="compact"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'one', label: 'Dieser Termin' },
            { value: 'all', label: 'Alle Termine' },
          ]}
        />
      )}
      <div className="grid grid-cols-3 gap-2">
        {answers.map((option) => (
          <Button
            key={option.value}
            variant={shown === option.value ? 'primary' : 'secondary'}
            aria-pressed={shown === option.value}
            onClick={() => {
              answer(option.value);
            }}
          >
            {option.label}
          </Button>
        ))}
      </div>
      <Button
        variant="ghost"
        onClick={() => {
          setProposing(true);
        }}
      >
        {current === 'proposed' ? 'Anderen Vorschlag machen' : 'Andere Zeit vorschlagen'}
      </Button>
      {respond.isError && (
        <p role="alert" className="text-footnote text-danger">
          Antwort hat nicht geklappt.
        </p>
      )}
      <ProposeSheet
        plan={plan}
        open={proposing}
        onOpenChange={setProposing}
        onProposed={() => {
          setScope('one');
        }}
      />
    </div>
  );
}

function ProposeSheet({
  plan,
  open,
  onOpenChange,
  onProposed,
}: {
  plan: PlanOccurrence;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProposed: () => void;
}) {
  const [date, setDate] = useState(plan.onDate);
  const [time, setTime] = useState(plan.startTime ?? '');
  const respond = useRespond();
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Andere Zeit">
      <form
        className="flex flex-col gap-6 pt-1"
        onSubmit={(event) => {
          event.preventDefault();
          respond.mutate(
            {
              planId: plan.planId,
              planDate: plan.planDate,
              status: 'proposed',
              proposedDate: date,
              ...(time && { proposedTime: time }),
            },
            {
              onSuccess: () => {
                onOpenChange(false);
                onProposed();
              },
            },
          );
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Tag"
            type="date"
            className="h-tap appearance-none"
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
            }}
          />
          <TextField
            label="Uhrzeit (optional)"
            type="time"
            className="h-tap appearance-none"
            value={time}
            onChange={(event) => {
              setTime(event.target.value);
            }}
          />
        </div>
        <p className="text-footnote text-text-muted">
          {plan.recurring ? 'Gilt nur für diesen Termin. ' : ''}Mit einem Tap kann der Termin
          übernommen werden.
        </p>
        {respond.isError && (
          <p role="alert" className="text-footnote text-danger">
            Vorschlag hat nicht geklappt.
          </p>
        )}
        <Button
          type="submit"
          size="lg"
          missing={date ? null : 'Wähl einen Tag.'}
          loading={respond.isPending}
        >
          Vorschlagen
        </Button>
      </form>
    </Sheet>
  );
}

function JoinButton({ plan }: { plan: PlanOccurrence }) {
  const join = useRequestJoin();
  return (
    <>
      <Button
        variant="secondary"
        loading={join.isPending}
        onClick={() => {
          join.mutate(plan.planId);
        }}
      >
        Ich komm mit
      </Button>
      {join.isError && (
        <p role="alert" className="text-footnote text-danger">
          Anfrage hat nicht geklappt.
        </p>
      )}
    </>
  );
}
