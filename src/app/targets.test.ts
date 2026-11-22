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

  it('opens a workout, an exercise or a set with its thread', () => {
    expect(targetPath({ groupId: 'g', type: 'workout', id: 'w1' }, { thread: true })).toBe(
      '/gruppe?training=w1&thread=1',
    );
    expect(
      targetPath(
        { groupId: 'g', type: 'workout_item', id: 'i1', index: 2 },
        { thread: true, commentId: 'c1' },
      ),
    ).toBe('/gruppe?uebung=i1&satz=2&thread=1&kommentar=c1');
  });

  it('falls back to the group tab for unknown types', () => {
    expect(targetPath({ ...event, type: 'unknown' }, { thread: true })).toBe('/gruppe');
  });

  it('opens a workout started by someone else (training together)', () => {
    expect(targetPath({ groupId: 'g', type: 'live_workout', id: 'w1' }, { thread: false })).toBe(
      '/training/live',
    );
  });

  it('opens a habit in the check-in on Heute (reminders)', () => {
    expect(targetPath({ groupId: 'g', type: 'habit', id: 'h1' }, { thread: false })).toBe(
      '/heute?checkin=h1',
    );
  });

  it('opens a plan in the training tab', () => {
    expect(targetPath({ groupId: 'g', type: 'plan', id: 'p1' }, { thread: false })).toBe(
      '/training?termin=p1',
    );
  });
});
