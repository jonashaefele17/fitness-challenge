import { describe, expect, it } from 'vitest';
import { inviteErrorMessage, readAuthErrorFromUrl } from './errors';

describe('inviteErrorMessage', () => {
  it('maps known RPC error codes to German text', () => {
    expect(inviteErrorMessage({ message: 'invite_invalid' })).toMatch(/ungültig/);
    expect(inviteErrorMessage({ message: 'already_member' })).toMatch(/bereits Mitglied/);
  });

  it('falls back for unknown errors', () => {
    expect(inviteErrorMessage(new Error('boom'))).toMatch(/nicht geklappt/);
    expect(inviteErrorMessage(null)).toMatch(/nicht geklappt/);
  });
});

describe('readAuthErrorFromUrl', () => {
  it('returns null without an error', () => {
    expect(readAuthErrorFromUrl('https://x.test/app/?code=abc')).toBeNull();
  });

  it('detects a cancelled sign-in in the query', () => {
    expect(readAuthErrorFromUrl('https://x.test/app/?error=access_denied')).toMatch(/abgebrochen/);
  });

  it('detects errors in the hash', () => {
    expect(readAuthErrorFromUrl('https://x.test/app/#error=server_error')).toMatch(
      /nicht geklappt/,
    );
  });
});
