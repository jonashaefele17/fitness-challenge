import { describe, expect, it } from 'vitest';
import { describeNotification, isCategoryEnabled, isReminder } from './settings';

const reactions = {
  key: 'reactions',
  label: 'Reaktionen',
  description: '',
  presets: { important: false, standard: true, all: true },
};

describe('isCategoryEnabled', () => {
  it('follows the preset without override', () => {
    expect(isCategoryEnabled(reactions, 'important', {})).toBe(false);
    expect(isCategoryEnabled(reactions, 'standard', {})).toBe(true);
  });

  it('lets an override win over the preset', () => {
    expect(isCategoryEnabled(reactions, 'standard', { reactions: false })).toBe(false);
    expect(isCategoryEnabled(reactions, 'important', { reactions: true })).toBe(true);
  });
});

describe('describeNotification', () => {
  it('distinguishes comments on my objects from general activity', () => {
    expect(describeNotification({ event: 'comment', category: 'comments_on_mine' })).toBe(
      'hat deinen Beitrag kommentiert',
    );
    expect(describeNotification({ event: 'comment', category: 'all_activity' })).toBe(
      'hat kommentiert',
    );
  });

  it('describes mentions and reactions', () => {
    expect(describeNotification({ event: 'mention', category: 'mentions' })).toBe(
      'hat dich erwähnt',
    );
    expect(describeNotification({ event: 'reaction', category: 'reactions' })).toBe(
      'hat mit 🔥 reagiert',
    );
    expect(describeNotification({ event: 'reaction', category: 'reactions', emoji: '💪' })).toBe(
      'hat mit 💪 reagiert',
    );
    expect(describeNotification({ event: 'workout_finished', category: 'all_activity' })).toBe(
      'hat trainiert',
    );
  });

  it('names what was commented on', () => {
    const comment = { event: 'comment', category: 'comments_on_mine' };
    expect(describeNotification({ ...comment, target: { type: 'workout_item', index: 2 } })).toBe(
      'hat deinen Satz kommentiert',
    );
    expect(describeNotification({ ...comment, target: { type: 'workout_item' } })).toBe(
      'hat deine Übung kommentiert',
    );
    expect(describeNotification({ ...comment, target: { type: 'workout' } })).toBe(
      'hat dein Training kommentiert',
    );
  });

  it('words the weigh-in reminder on its own', () => {
    expect(describeNotification({ event: 'weigh_reminder', category: 'body' })).toBe('Wiegen');
    expect(isReminder('weigh_reminder')).toBe(true);
  });

  it('words the Zwischenstand reminder on its own', () => {
    expect(describeNotification({ event: 'body_checkin_reminder', category: 'body' })).toBe(
      'Zwischenstand',
    );
    expect(isReminder('body_checkin_reminder')).toBe(true);
  });
});
