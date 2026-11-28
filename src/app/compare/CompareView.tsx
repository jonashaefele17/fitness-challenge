import { useState } from 'react';
import { todayKey } from '@/features/body';
import { HabitComparison, TrainingComparison, WeightComparison } from '@/features/comparison';
import { useCurrentSeason } from '@/features/seasons';
import { Chip, SegmentedControl, type SegmentedOption } from '@/shared/ui';
import { comparePeriodRange, periodSeason, shownPeriod, type ComparePeriod } from './period';

type CompareWhat = 'trainings' | 'habits' | 'weight';

/** Vergleich → Was; `periods`: whether the Zeitraum applies to the view. */
const WHAT: { value: CompareWhat; label: string; periods: boolean }[] = [
  { value: 'trainings', label: 'Trainings', periods: true },
  { value: 'habits', label: 'Habits', periods: false },
  { value: 'weight', label: 'Gewicht', periods: true },
];

const FIXED_PERIODS: SegmentedOption<ComparePeriod>[] = [
  { value: '4w', label: '4 Wochen' },
  { value: '3m', label: '3 Monate' },
  { value: '1y', label: '1 Jahr' },
];

/**
 * Gruppe → Vergleich: what to compare (a swipeable row) and over which period, then the
 * view from the comparison module. The period "Saison" is the current season once it has
 * started – the default while it runs – and goes into the views as plain dates, so the
 * comparison module knows nothing of seasons.
 */
export function CompareView({ onOpenSharing }: { onOpenSharing: () => void }) {
  const [today] = useState(todayKey);
  const [what, setWhat] = useState<CompareWhat>('trainings');
  const [chosen, setChosen] = useState<ComparePeriod | null>(null);
  const season = periodSeason(useCurrentSeason().data);
  const period = shownPeriod(chosen, season);
  const { from, to } = comparePeriodRange(period, today, season);
  const withPeriods = WHAT.find((w) => w.value === what)?.periods ?? false;

  return (
    <div className="flex flex-col gap-4">
      <div
        role="group"
        aria-label="Was"
        className="-mx-gutter no-scrollbar flex gap-2 overflow-x-auto px-gutter py-1.5"
      >
        {WHAT.map((option) => (
          <Chip
            key={option.value}
            selected={option.value === what}
            onClick={() => {
              setWhat(option.value);
            }}
          >
            {option.label}
          </Chip>
        ))}
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
      {what === 'trainings' ? (
        <TrainingComparison from={from} to={to} />
      ) : what === 'weight' ? (
        <WeightComparison from={from} to={to} onOpenSharing={onOpenSharing} />
      ) : (
        <HabitComparison />
      )}
    </div>
  );
}
