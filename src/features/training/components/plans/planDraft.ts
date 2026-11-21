import type { PlanDraft } from '../../types';

/** ISO weekday (1 = Monday) of a "2026-12-07" date. */
export function isoWeekday(day: string): number {
  const weekday = new Date(`${day}T12:00:00`).getDay();
  return weekday === 0 ? 7 : weekday;
}

export function emptyPlan(day: string): PlanDraft {
  return {
    id: null,
    kind: 'training',
    trainingTypeId: null,
    templateId: null,
    title: '',
    note: '',
    startsOn: day,
    startTime: '',
    repeatWeekdays: [],
    repeatUntil: '',
  };
}
