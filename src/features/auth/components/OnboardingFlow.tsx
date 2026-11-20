import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { spring } from '@/shared/design-tokens';
import { Button, Card, TextField } from '@/shared/ui';
import { useCheckInvite, useRedeemInvite } from '../api/useInvite';
import { useSignOut } from '../api/useSignIn';
import { inviteErrorMessage } from '../errors';
import type { InviteCheck } from '../types';

export interface OnboardingFlowProps {
  /** Whether the user already has a profile (then only the code is needed). */
  hasProfile: boolean;
  /** Name suggested from the Google account. */
  suggestedName: string;
}

type Step = { kind: 'code' } | { kind: 'profile'; code: string; invite: InviteCheck };

const stepMotion = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
  transition: spring.snappy,
};

/** First login: invite code → name and home gym → joins the group. */
export function OnboardingFlow({ hasProfile, suggestedName }: OnboardingFlowProps) {
  const [step, setStep] = useState<Step>({ kind: 'code' });
  const signOut = useSignOut();

  return (
    <main className="flex min-h-dvh flex-col px-gutter pt-safe pb-safe">
      <div className="flex justify-end pt-2">
        <Button
          variant="ghost"
          onClick={() => {
            signOut.mutate();
          }}
        >
          Abmelden
        </Button>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {step.kind === 'code' ? (
          <motion.div key="code" className="flex flex-1 flex-col" {...stepMotion}>
            <CodeStep
              hasProfile={hasProfile}
              onValid={(code, invite) => {
                setStep({ kind: 'profile', code, invite });
              }}
            />
          </motion.div>
        ) : (
          <motion.div key="profile" className="flex flex-1 flex-col" {...stepMotion}>
            <ProfileStep
              code={step.code}
              invite={step.invite}
              suggestedName={suggestedName}
              onBack={() => {
                setStep({ kind: 'code' });
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function CodeStep({
  hasProfile,
  onValid,
}: {
  hasProfile: boolean;
  onValid: (code: string, invite: InviteCheck) => void;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const check = useCheckInvite();
  const redeem = useRedeemInvite();

  async function submit() {
    setError(null);
    try {
      const invite = await check.mutateAsync(code);
      if (!invite) {
        setError(inviteErrorMessage({ message: 'invite_invalid' }));
        return;
      }
      // Existing profile (e.g. removed from all groups): join directly.
      if (hasProfile) await redeem.mutateAsync({ code });
      else onValid(code, invite);
    } catch (err) {
      setError(inviteErrorMessage(err));
    }
  }

  return (
    <form
      className="flex flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="flex flex-1 flex-col justify-center gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-large-title font-bold">Einladung</h1>
          <p className="text-body text-text-muted">
            Gib den Code ein, den du von deiner Gruppe bekommen hast.
          </p>
        </div>
        <TextField
          label="Invite-Code"
          placeholder="XXXX-XXXX-XXXX"
          autoComplete="one-time-code"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="font-mono tracking-wider uppercase"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
          }}
          error={error}
        />
      </div>
      <div className="pb-6">
        <Button
          type="submit"
          size="lg"
          fullWidth
          disabled={code.trim().length < 4}
          loading={check.isPending || redeem.isPending}
        >
          Weiter
        </Button>
      </div>
    </form>
  );
}

function ProfileStep({
  code,
  invite,
  suggestedName,
  onBack,
}: {
  code: string;
  invite: InviteCheck;
  suggestedName: string;
  onBack: () => void;
}) {
  const [displayName, setDisplayName] = useState(suggestedName);
  const [homeGym, setHomeGym] = useState('');
  const redeem = useRedeemInvite();
  const nameValid = displayName.trim().length > 0 && displayName.trim().length <= 40;

  return (
    <form
      className="flex flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        redeem.mutate({ code, displayName: displayName.trim(), homeGym: homeGym.trim() });
      }}
    >
      <div className="flex flex-1 flex-col justify-center gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-large-title font-bold">Fast geschafft</h1>
          <Card elevated className="text-subhead text-text-muted">
            Du trittst <span className="font-semibold text-text">{invite.groupName}</span> bei.
          </Card>
        </div>
        <TextField
          label="Dein Name"
          autoComplete="given-name"
          maxLength={40}
          value={displayName}
          onChange={(event) => {
            setDisplayName(event.target.value);
          }}
          hint="So sehen dich die anderen."
        />
        <TextField
          label="Heimstudio (optional)"
          placeholder="z. B. FitX Karlsruhe"
          maxLength={60}
          value={homeGym}
          onChange={(event) => {
            setHomeGym(event.target.value);
          }}
          error={redeem.isError ? inviteErrorMessage(redeem.error) : null}
        />
      </div>
      <div className="flex flex-col gap-2 pb-6">
        <Button type="submit" size="lg" fullWidth disabled={!nameValid} loading={redeem.isPending}>
          Los geht&apos;s
        </Button>
        <Button variant="ghost" fullWidth onClick={onBack} disabled={redeem.isPending}>
          Anderer Code
        </Button>
      </div>
    </form>
  );
}
