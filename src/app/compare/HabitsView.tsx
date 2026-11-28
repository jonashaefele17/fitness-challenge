import { HabitComparison, HabitWeeksChart, useGroupHabitWeeks } from '@/features/comparison';
import { useSeasonHabitWeeks, type Season } from '@/features/seasons';

function SeasonHabitWeeks({ season }: { season: Season }) {
  const weeks = useSeasonHabitWeeks(season.id);
  return (
    <HabitWeeksChart
      weeks={weeks.data ?? []}
      isPending={weeks.isPending}
      note="Quote über die Saison-Habits, je ab dem eigenen Saisonstart – von privaten nur die Quote. Die Tabelle darunter zeigt die geteilten Habits der letzten 4 Wochen."
    />
  );
}

function SharedHabitWeeks({ from, to, today }: { from: string; to: string; today: string }) {
  const weeks = useGroupHabitWeeks(from, to, today);
  return (
    <HabitWeeksChart
      weeks={weeks.data ?? []}
      isPending={weeks.isPending}
      note="Quote über die geteilten Habits · Pausen und offene Tage zählen nicht"
    />
  );
}

/**
 * Vergleich → Habits: the quota per week – over the season habits (from the seasons module)
 * in the period "Saison", else over the shared habits (from the comparison module) – above
 * the unchanged habit matrix, which keeps its own last 4 weeks.
 */
export function HabitsView({
  season,
  from,
  to,
  today,
}: {
  /** Set for the period "Saison". */
  season: Season | null;
  from: string;
  to: string;
  today: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      {season ? (
        <SeasonHabitWeeks season={season} />
      ) : (
        <SharedHabitWeeks from={from} to={to} today={today} />
      )}
      <HabitComparison />
    </div>
  );
}
