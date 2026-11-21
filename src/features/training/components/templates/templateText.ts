import type { TemplateItem } from '../../types';

/** "3 × 8–12 · 1 W", "4 × 10", "2 × 45 s · beidseitig · 15 s Pause" */
export function itemPlan(item: TemplateItem): string {
  if (item.exercise.measure === 'duration') {
    return [
      `${String(item.sets)}${item.durationSeconds ? ` × ${String(item.durationSeconds)} s` : ''}`,
      item.perSide ? 'beidseitig' : null,
      item.restSeconds > 0 ? `${String(item.restSeconds)} s Pause` : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }
  const target =
    item.repMin && item.repMax && item.repMin !== item.repMax
      ? ` × ${String(item.repMin)}–${String(item.repMax)}`
      : item.repMin || item.repMax
        ? ` × ${String(item.repMin ?? item.repMax)}`
        : ' Sätze';
  const warmup = item.warmupSets > 0 ? ` · ${String(item.warmupSets)} W` : '';
  return `${String(item.sets)}${target}${warmup}`;
}
