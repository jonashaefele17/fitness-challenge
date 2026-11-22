import { describe, expect, it } from 'vitest';
import { buildIcs, firstOn } from './ics';

const now = new Date('2026-11-23T10:00:00Z');

function lines(text: string): string[] {
  return text.replace(/\r\n /g, '').split('\r\n');
}

describe('buildIcs', () => {
  it('writes one timed date of an hour', () => {
    const out = lines(
      buildIcs(
        [{ uid: 'p1-2026-11-24@fc', summary: 'Studio · Push', date: '2026-11-24', time: '18:00' }],
        now,
      ),
    );
    expect(out).toContain('DTSTART:20261124T180000');
    expect(out).toContain('DTEND:20261124T190000');
    expect(out).toContain('SUMMARY:Studio · Push');
    expect(out).not.toContain('BEGIN:VALARM');
  });

  it('writes a date without time as all day', () => {
    const out = lines(
      buildIcs([{ uid: 'e', summary: 'Stadtlauf', date: '2026-12-13', time: null }], now),
    );
    expect(out).toContain('DTSTART;VALUE=DATE:20261213');
    expect(out).toContain('DTEND;VALUE=DATE:20261214');
  });

  it('writes a weekly series with its weekdays, end and left-out dates', () => {
    const out = lines(
      buildIcs(
        [
          {
            uid: 'p1@fc',
            summary: 'Studio',
            date: '2026-11-23',
            time: '18:00',
            weekdays: [4, 2],
            until: '2026-12-31',
            exceptDates: ['2026-12-01'],
          },
        ],
        now,
      ),
    );
    // Starts on the first chosen weekday (Tuesday 24), not on the plan's first day.
    expect(out).toContain('DTSTART:20261124T180000');
    expect(out).toContain('RRULE:FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20261231T235959');
    expect(out).toContain('EXDATE:20261201T180000');
  });

  it('escapes text and folds long lines', () => {
    const text = buildIcs(
      [
        {
          uid: 'x',
          summary: 'A, B; C',
          description: `Zeile 1\n${'lang '.repeat(30)}`,
          date: '2026-11-24',
          time: null,
        },
      ],
      now,
    );
    expect(lines(text)).toContain('SUMMARY:A\\, B\\; C');
    expect(text.split('\r\n').every((line) => line.length <= 61)).toBe(true);
  });
});

describe('firstOn', () => {
  it('finds the first chosen weekday on or after a date', () => {
    expect(firstOn('2026-11-23', [2, 4])).toBe('2026-11-24');
    expect(firstOn('2026-11-24', [2])).toBe('2026-11-24');
  });
});
