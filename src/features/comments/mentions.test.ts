import { describe, expect, it } from 'vitest';
import { activeMentionQuery, insertMention, resolveMentions, splitMentions } from './mentions';

const members = [
  { userId: 'a', displayName: 'Anna' },
  { userId: 'b', displayName: 'Ben' },
];

describe('activeMentionQuery', () => {
  it('detects a mention being typed', () => {
    expect(activeMentionQuery('Hey @An')).toBe('An');
    expect(activeMentionQuery('@')).toBe('');
  });

  it('ignores e-mail-like text and finished words', () => {
    expect(activeMentionQuery('mail@test')).toBeNull();
    expect(activeMentionQuery('Hey @Anna ')).toBeNull();
  });
});

describe('insertMention', () => {
  it('replaces the typed query with the full name', () => {
    expect(insertMention('Hey @An', 'Anna')).toBe('Hey @Anna ');
  });
});

describe('resolveMentions', () => {
  it('keeps only names still present in the text', () => {
    expect(resolveMentions('Danke @Anna!', members)).toEqual(['a']);
    expect(resolveMentions('Danke!', members)).toEqual([]);
  });
});

describe('splitMentions', () => {
  it('marks mention parts', () => {
    expect(splitMentions('Hi @Ben, top!', ['Anna', 'Ben'])).toEqual([
      { text: 'Hi ', mention: false },
      { text: '@Ben', mention: true },
      { text: ', top!', mention: false },
    ]);
  });
});
