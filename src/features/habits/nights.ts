import type { HabitDay, HabitDefinition } from './types';

// Minutes after 18:00 (so a night does not wrap).
export function rel(t: string): number {
  const [hh = 0, mm = 0] = t.split(':').map(Number);
  return (hh * 60 + mm - 18 * 60 + 24 * 60) % (24 * 60);
}

/** The time span (minutes after 18:00) the nights of one or more people need. */
export function nightAxis(lists: HabitDay[][], def: HabitDefinition): { lo: number; hi: number } {
  const known = lists
    .flat()
    .flatMap((d) =>
      d.value && 'start' in d.value ? [{ a: rel(d.value.start), b: rel(d.value.end) }] : [],
    );
  const bedBefore = def.rule.find((c) => c.field === 'start');
  const limit = bedBefore ? rel(String(bedBefore.value)) : null;
  return {
    lo: Math.max(0, Math.min(...known.map((p) => p.a), limit ?? 24 * 60) - 30),
    hi: Math.min(24 * 60, Math.max(...known.map((p) => p.b), 13 * 60) + 30),
  };
}

/** "23:30" from minutes after 18:00. */
export function nightClock(m: number): string {
  const t = (m + 18 * 60) % (24 * 60);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}
