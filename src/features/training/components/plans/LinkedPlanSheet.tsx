import { useState } from 'react';
import { useNextPlanDate } from '../../api/usePlans';
import { dayKey } from '../../calendar';
import { PlanDetailSheet } from './PlanDetailSheet';

/** A plan opened from a link (bell, push): its next date's detail. */
export function LinkedPlanSheet({
  planId,
  onClose,
}: {
  planId: string | null;
  onClose: () => void;
}) {
  const [today] = useState(() => dayKey(new Date()));
  const plan = useNextPlanDate(planId).data ?? null;
  return <PlanDetailSheet plan={planId ? plan : null} today={today} onClose={onClose} />;
}
