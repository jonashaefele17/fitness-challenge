import type { TemplateItem } from '../../types';

/** "3 × 8–12 · 1 W", "4 × 10", "2 × 45 s" */
export function itemPlan(item: TemplateItem): string {
  const target =
    item.exercise.measure === 'duration'
      ? item.durationSeconds
        ? ` × ${String(item.durationSeconds)} s`
        : ''
      : item.repMin && item.repMax && item.repMin !== item.repMax
        ? ` × ${String(item.repMin)}–${String(item.repMax)}`
        : item.repMin || item.repMax
          ? ` × ${String(item.repMin ?? item.repMax)}`
          : ' Sätze';
  const warmup = item.warmupSets > 0 ? ` · ${String(item.warmupSets)} W` : '';
  return `${String(item.sets)}${target}${warmup}`;
}
