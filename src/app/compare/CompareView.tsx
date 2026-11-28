import { useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { todayKey } from '@/features/body';
import { TrainingComparison, WeightComparison } from '@/features/comparison';
import type { Goal } from '@/features/goals';
import { useActiveGroup } from '@/features/groups';
import {
  hasStrengthComparison,
  SeasonOverview,
  SeasonStrength,
  useCurrentSeason,
  useSeasonOverview,
} from '@/features/seasons';
import { Chip, SegmentedControl, type SegmentedOption } from '@/shared/ui';
import { GoalComments } from '../goals/GoalComments';
import { HabitsView } from './HabitsView';
import {
  comparePeriodRange,
  periodSeason,
  shownPeriod,
  shownWhat,
  type ComparePeriod,
  type CompareWhat,
} from './period';

/**
 * Vergleich → Was; `periods`: whether the Zeitraum applies to the view; `season`: only
 * with a season (running or ended); `strength`: only when two participants have a strength
 * goal.
 */
const WHAT: {
  value: CompareWhat;
  label: string;
  periods: boolean;
  season?: boolean;
  strength?: boolean;
}[] = [
  { value: 'overview', label: 'Übersicht', periods: false, season: true },
  { value: 'trainings', label: 'Trainings', periods: true },
  { value: 'habits', label: 'Habits', periods: true },
  { value: 'weight', label: 'Gewicht', periods: true },
  { value: 'strength', label: 'Kraft', periods: false, season: true, strength: true },
];

const FIXED_PERIODS: SegmentedOption<ComparePeriod>[] = [
  { value: '4w', label: '4 Wochen' },
  { value: '3m', label: '3 Monate' },
  { value: '1y', label: '1 Jahr' },
];

/**
 * Gruppe → Vergleich: what to compare (a swipeable row) and over which period, then the
 * view from the comparison module – or the season's overview and strength from the seasons
 * module (the overview is the first entry while there is a season and the default while it
 * runs; both always show the season). The period "Saison" is the current season once it
 * has started – the default while it runs – and goes into the comparison views as plain
 * dates, so the comparison module knows nothing of seasons; Habits takes the season habits'
 * weeks from the seasons module for it (HabitsView).
 */
export function CompareView({ onOpenSharing }: { onOpenSharing: () => void }) {
  const [today] = useState(todayKey);
  const reduceMotion = useReducedMotion();
  const { group } = useActiveGroup();
  const [chosenWhat, setWhat] = useState<CompareWhat | null>(null);
  const [chosen, setChosen] = useState<ComparePeriod | null>(null);
  const season = periodSeason(useCurrentSeason().data);
  const strength = hasStrengthComparison(useSeasonOverview(season?.id ?? null).data);
  const what = shownWhat(chosenWhat, season, strength);
  const period = shownPeriod(chosen, season);
  const { from, to } = comparePeriodRange(period, today, season);
  const withPeriods = WHAT.find((w) => w.value === what)?.periods ?? false;
  const goalExtra = (goal: Goal) => <GoalComments goal={goal} groupId={group.id} />;

  return (
    <div className="flex flex-col gap-4">
      <div
        role="group"
        aria-label="Was"
        className="-mx-gutter no-scrollbar flex scroll-px-gutter gap-2 overflow-x-auto px-gutter py-1.5"
      >
        {WHAT.filter((option) => (!option.season || season) && (!option.strength || strength)).map(
          (option) => (
            <Chip
              key={option.value}
              selected={option.value === what}
              onClick={(event) => {
                setWhat(option.value);
                // A chip cut off at the edge of the row slides fully into view.
                event.currentTarget.scrollIntoView({
                  behavior: reduceMotion ? 'auto' : 'smooth',
                  block: 'nearest',
                  inline: 'nearest',
                });
              }}
            >
              {option.label}
            </Chip>
          ),
        )}
      </div>
      {withPeriods && (
        <SegmentedControl
          label="Zeitraum"
          value={period}
          onChange={setChosen}
          options={
            season ? [{ value: 'season', label: 'Saison' }, ...FIXED_PERIODS] : FIXED_PERIODS
          }
        />
      )}
      {what === 'overview' && season ? (
        <SeasonOverview season={season} goalExtra={goalExtra} />
      ) : what === 'strength' && season ? (
        <SeasonStrength season={season} goalExtra={goalExtra} />
      ) : what === 'trainings' ? (
        <TrainingComparison from={from} to={to} />
      ) : what === 'weight' ? (
        <WeightComparison from={from} to={to} onOpenSharing={onOpenSharing} />
      ) : (
        <HabitsView
          season={period === 'season' ? season : null}
          from={from}
          to={to}
          today={today}
        />
      )}
    </div>
  );
}
