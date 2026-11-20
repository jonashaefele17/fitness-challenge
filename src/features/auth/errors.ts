const inviteErrorMessages: Record<string, string> = {
  invite_invalid: 'Dieser Code ist ungültig, abgelaufen oder schon verbraucht.',
  already_member: 'Du bist bereits Mitglied dieser Gruppe.',
  display_name_required: 'Bitte gib deinen Namen ein.',
  not_authenticated: 'Deine Sitzung ist abgelaufen. Bitte melde dich neu an.',
};

const fallback = 'Das hat nicht geklappt. Bitte versuch es noch einmal.';

/** Maps errors raised by the invite RPCs (exception message = code) to German UI text. */
export function inviteErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const { message } = error;
    if (typeof message === 'string' && message in inviteErrorMessages) {
      return inviteErrorMessages[message] ?? fallback;
    }
  }
  return fallback;
}

/** Reads an OAuth error the provider appended to the URL (e.g. the user cancelled). */
export function readAuthErrorFromUrl(href: string): string | null {
  const url = new URL(href);
  const params = new URLSearchParams(url.hash.replace(/^#/, ''));
  url.searchParams.forEach((value, key) => {
    params.set(key, value);
  });
  if (!params.has('error')) return null;
  return params.get('error') === 'access_denied'
    ? 'Die Anmeldung wurde abgebrochen.'
    : 'Die Anmeldung hat nicht geklappt. Bitte versuch es noch einmal.';
}
