import type { TemplateSummary } from './types';

/** Unused for this long: moves to "Lange nicht genutzt" (mine) or drops out of "Von der Gruppe". */
export const STALE_DAYS = 60;
/** Shown before "Alle Vorlagen". */
export const TOP_COUNT = 6;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface TemplateSections {
  /** Mine and group mates' I have used, most recently used first (never used: by name). */
  active: TemplateSummary[];
  /** Mine not used for STALE_DAYS (offered for archiving). */
  stale: TemplateSummary[];
  /** Group mates' I have not used yet, active lately at their owner. */
  group: TemplateSummary[];
  /** My archived templates. */
  archived: TemplateSummary[];
}

const daysSince = (iso: string, now: number) => (now - new Date(iso).getTime()) / DAY_MS;

/** Sorts templates into the sections that keep the list short (see concept: Vorlagen). */
export function templateSections(
  templates: TemplateSummary[],
  now: number,
  trainingTypeId?: string,
): TemplateSections {
  const sections: TemplateSections = { active: [], stale: [], group: [], archived: [] };
  for (const template of templates) {
    if (trainingTypeId && template.trainingTypeId !== trainingTypeId) continue;
    if (template.archivedAt) {
      if (template.mine) sections.archived.push(template);
      continue;
    }
    if (!template.mine && !template.myLastUsedAt) {
      if (template.ownerLastUsedAt && daysSince(template.ownerLastUsedAt, now) <= STALE_DAYS) {
        sections.group.push(template);
      }
      continue;
    }
    if (template.myLastUsedAt && daysSince(template.myLastUsedAt, now) > STALE_DAYS) {
      if (template.mine) sections.stale.push(template);
      continue;
    }
    sections.active.push(template);
  }
  const byUse = (a: TemplateSummary, b: TemplateSummary) =>
    (b.myLastUsedAt ?? '').localeCompare(a.myLastUsedAt ?? '') ||
    a.name.localeCompare(b.name, 'de');
  sections.active.sort(byUse);
  sections.stale.sort(byUse);
  sections.group.sort(
    (a, b) =>
      (b.ownerLastUsedAt ?? '').localeCompare(a.ownerLastUsedAt ?? '') ||
      a.name.localeCompare(b.name, 'de'),
  );
  sections.archived.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  return sections;
}

/**
 * The template of mine with the same exercises in the same order, if any – offered for
 * updating instead of creating a near-duplicate.
 */
export function findSimilarTemplate(
  exerciseIds: string[],
  candidates: { id: string; exerciseIds: string[] }[],
): string | null {
  const key = exerciseIds.join(',');
  return candidates.find((candidate) => candidate.exerciseIds.join(',') === key)?.id ?? null;
}

/** "Push · Studio" from focus and training type (editable before saving). */
export function suggestTemplateName(focusName: string | null, typeName: string): string {
  return focusName ? `${focusName} · ${typeName}` : typeName;
}
