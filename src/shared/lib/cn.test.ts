import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('keeps font-size and colour tokens side by side', () => {
    expect(cn('text-body text-text', 'text-accent')).toBe('text-body text-accent');
  });

  it('lets later font-size tokens win', () => {
    expect(cn('text-body', 'text-title-1')).toBe('text-title-1');
  });

  it('drops falsy values', () => {
    expect(cn('a', false, undefined, 'b')).toBe('a b');
  });
});
