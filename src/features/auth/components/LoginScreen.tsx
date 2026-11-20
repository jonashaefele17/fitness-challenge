import { useState } from 'react';
import { Button, GoogleIcon, TextField } from '@/shared/ui';
import { useSendDevLoginCode, useSignInWithGoogle, useVerifyDevLoginCode } from '../api/useSignIn';
import { readAuthErrorFromUrl } from '../errors';

export function LoginScreen() {
  const signIn = useSignInWithGoogle();
  const [urlError] = useState(() => readAuthErrorFromUrl(window.location.href));
  const error = signIn.isError
    ? 'Die Anmeldung konnte nicht gestartet werden. Bitte versuch es noch einmal.'
    : urlError;

  return (
    <main className="flex min-h-dvh flex-col px-gutter pt-safe pb-safe">
      <div className="flex flex-1 flex-col justify-center gap-4">
        <div aria-hidden className="mb-4 size-16 rounded-card bg-accent" />
        <h1 className="text-large-title font-bold">Fitness Challenge</h1>
        <p className="text-body text-text-muted">
          Gemeinsam trainieren, Fortschritt sichtbar machen und dranbleiben.
        </p>
      </div>

      <div className="flex flex-col gap-3 pb-6">
        {error && (
          <p role="alert" className="text-center text-footnote text-danger">
            {error}
          </p>
        )}
        <Button
          size="lg"
          fullWidth
          loading={signIn.isPending}
          leadingIcon={<GoogleIcon className="text-title-3" />}
          onClick={() => {
            signIn.mutate();
          }}
        >
          Mit Google anmelden
        </Button>
        <p className="text-center text-footnote text-text-subtle">
          Zugang nur mit Einladung. Den Code bekommst du von deiner Gruppe.
        </p>
        {import.meta.env.DEV && <DevLogin />}
      </div>
    </main>
  );
}

/** Local development only: email one-time code, delivered to Mailpit (127.0.0.1:54324). */
function DevLogin() {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const sendCode = useSendDevLoginCode();
  const verify = useVerifyDevLoginCode();

  return (
    <details className="mt-4 rounded-card border border-border p-4 text-subhead">
      <summary className="cursor-pointer text-text-muted">Dev-Login (nur lokal)</summary>
      <form
        className="mt-4 flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (sendCode.isSuccess) verify.mutate({ email, token });
          else sendCode.mutate(email);
        }}
      >
        <TextField
          label="E-Mail"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
          }}
          required
        />
        {sendCode.isSuccess && (
          <TextField
            label="Code aus Mailpit"
            hint="http://127.0.0.1:54324"
            inputMode="numeric"
            value={token}
            onChange={(event) => {
              setToken(event.target.value);
            }}
            error={verify.isError ? 'Code ungültig.' : null}
            required
          />
        )}
        <Button type="submit" variant="secondary" loading={sendCode.isPending || verify.isPending}>
          {sendCode.isSuccess ? 'Anmelden' : 'Code senden'}
        </Button>
      </form>
    </details>
  );
}
