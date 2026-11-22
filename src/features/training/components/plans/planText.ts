import type { PlanDraft, PlanOccurrence } from '../../types';

const SHORT = ['', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const until = new Intl.DateTimeFormat('de', { day: 'numeric', month: 'short', year: 'numeric' });

/** "Studio", "Stadtlauf" */
export function planTitle(plan: PlanOccurrence): string {
  return plan.kind === 'event' ? (plan.title ?? 'Event') : (plan.trainingType?.name ?? 'Training');
}

/** "Wöchentlich Mo, Do · bis 31. Dez. 2026" */
export function repeatText(draft: Pick<PlanDraft, 'repeatWeekdays' | 'repeatUntil'>): string {
  const days = draft.repeatWeekdays.map((day) => SHORT[day]).join(', ');
  const end = draft.repeatUntil
    ? ` · bis ${until.format(new Date(`${draft.repeatUntil}T12:00:00`))}`
    : '';
  return `Wöchentlich ${days}${end}`;
}
