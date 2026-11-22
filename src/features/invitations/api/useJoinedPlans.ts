import { useQueries, useQuery } from '@tanstack/react-query';
import { useUserId } from '@/features/auth';
import { planOccurrencesOptions, type PlanOccurrence } from '@/features/training';
import { supabase } from '@/shared/lib/supabase';
import { invitationKeys } from './useParticipation';

interface Joined {
  planId: string;
  ownerId: string;
  /** Dates of the plan I said no to. */
  declined: string[];
}

function todayKey(): string {
  const now = new Date();
  return `${String(now.getFullYear())}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Slot: other people's plan dates I take part in (not said no to), from today on, for my
 * own calendar. Past dates show what I actually did instead.
 */
export function useJoinedPlans(range: { from: Date; to: Date }): PlanOccurrence[] {
  const userId = useUserId();
  const joined = useQuery({
    queryKey: invitationKeys.joined(userId),
    queryFn: async (): Promise<Joined[]> => {
      const [plans, declined] = await Promise.all([
        supabase.rpc('my_joined_plans'),
        supabase
          .from('plan_responses')
          .select('plan_id, on_date')
          .eq('user_id', userId)
          .eq('status', 'declined'),
      ]);
      if (plans.error) throw plans.error;
      if (declined.error) throw declined.error;
      return plans.data.map((row) => ({
        planId: row.plan_id,
        ownerId: row.owner_id,
        declined: declined.data.filter((d) => d.plan_id === row.plan_id).map((d) => d.on_date),
      }));
    },
  }).data;
  const list = joined ?? [];
  const owners = [...new Set(list.map((j) => j.ownerId))];
  const results = useQueries({
    queries: owners.map((owner) => planOccurrencesOptions(userId, range, owner)),
  });
  const today = todayKey();
  return results.flatMap((result) =>
    (result.data ?? []).filter((occurrence) => {
      const mine = list.find((j) => j.planId === occurrence.planId);
      return (
        mine !== undefined &&
        occurrence.onDate >= today &&
        !mine.declined.includes(occurrence.planDate)
      );
    }),
  );
}
