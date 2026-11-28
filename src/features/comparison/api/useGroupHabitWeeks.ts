import { useQuery } from '@tanstack/react-query';
import { useActiveGroup } from '@/features/groups';
import { supabase } from '@/shared/lib/supabase';
import type { HabitWeek } from '../chart';

/**
 * The habit quota per calendar week of the active group's members from `from` to `to`, over
 * their shared habits (as the habit statistics count it, `today` deciding what is still
 * open). Whose habits I may not see, and private habits, do not arrive (the database
 * decides); a week in which nothing counted has no row.
 */
export function useGroupHabitWeeks(from: string, to: string, today: string) {
  const { group } = useActiveGroup();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return useQuery({
    queryKey: ['comparison', 'habitWeeks', group.id, from, to, today, timeZone],
    queryFn: async (): Promise<HabitWeek[]> => {
      const { data, error } = await supabase.rpc('group_habit_weeks', {
        p_group_id: group.id,
        p_from: from,
        p_to: to,
        p_today: today,
        p_time_zone: timeZone,
      });
      if (error) throw error;
      return data.map((row) => ({
        userId: row.user_id,
        weekStart: row.week_start,
        quotaPct: row.quota_pct,
      }));
    },
  });
}
