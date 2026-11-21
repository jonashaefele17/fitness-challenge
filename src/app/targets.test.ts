import { describe, expect, it } from 'vitest';
import { targetPath } from './targets';

const event = { groupId: 'g', type: 'feed_event', id: 'e1' };

describe('targetPath', () => {
  it('links a feed event to its card in the group tab', () => {
    expect(targetPath(event, { thread: false })).toBe('/gruppe?beitrag=e1');
  });

  it('opens the thread when asked', () => {
    expect(targetPath(event, { thread: true })).toBe('/gruppe?beitrag=e1&thread=1');
  });

  it('adds the comment to scroll to', () => {
    expect(targetPath(event, { thread: true, commentId: 'c1' })).toBe(
      '/gruppe?beitrag=e1&thread=1&kommentar=c1',
    );
  });

  it('links a day card and opens its thread', () => {
    expect(
      targetPath({ groupId: 'g', type: 'feed_day', id: 'd1' }, { thread: true, commentId: 'c1' }),
    ).toBe('/gruppe?karte=d1&thread=1&kommentar=c1');
  });

  it('falls back to the group tab for unknown types', () => {
    expect(targetPath({ ...event, type: 'unknown' }, { thread: true })).toBe('/gruppe');
  });
});
