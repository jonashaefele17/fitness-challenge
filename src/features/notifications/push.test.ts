import { describe, expect, it } from 'vitest';
import { pushSupport, urlBase64ToUint8Array } from './push';

describe('urlBase64ToUint8Array', () => {
  it('decodes base64url without padding', () => {
    expect([...urlBase64ToUint8Array('AQID_-8')]).toEqual([1, 2, 3, 255, 239]);
  });
});

describe('pushSupport', () => {
  it('reports a missing VAPID key first', () => {
    expect(pushSupport(null)).toBe('unconfigured');
  });

  it('detects missing Push API (jsdom has none)', () => {
    expect(pushSupport('key')).toBe('unsupported');
  });
});
