import { describe, expect, it } from 'vitest';
import { findSimilarTemplate, suggestTemplateName, templateSections } from './templateRules';
import type { TemplateSummary } from './types';

const NOW = new Date('2026-11-21T12:00:00Z').getTime();
const daysAgo = (days: number) => new Date(NOW - days * 86_400_000).toISOString();

function template(overrides: Partial<TemplateSummary>): TemplateSummary {
  return {
    id: 'x',
    ownerId: 'me',
    ownerName: 'Jonas',
    mine: true,
    name: 'Push',
    trainingTypeId: 'studio',
    focusId: null,
    note: null,
    archivedAt: null,
    exerciseCount: 5,
    myLastUsedAt: null,
    ownerLastUsedAt: null,
    ...overrides,
  };
}

describe('templateSections', () => {
  it('puts recently used first and new ones by name', () => {
    const sections = templateSections(
      [
        template({ id: 'b', name: 'B neu' }),
        template({ id: 'old', myLastUsedAt: daysAgo(20) }),
        template({ id: 'new', myLastUsedAt: daysAgo(2) }),
        template({ id: 'a', name: 'A neu' }),
      ],
      NOW,
    );
    expect(sections.active.map((t) => t.id)).toEqual(['new', 'old', 'a', 'b']);
  });

  it('moves my long-unused templates aside and hides archived ones', () => {
    const sections = templateSections(
      [
        template({ id: 'stale', myLastUsedAt: daysAgo(90) }),
        template({ id: 'gone', archivedAt: daysAgo(1) }),
      ],
      NOW,
    );
    expect(sections.active).toHaveLength(0);
    expect(sections.stale.map((t) => t.id)).toEqual(['stale']);
    expect(sections.archived.map((t) => t.id)).toEqual(['gone']);
  });

  it('shows group templates only while their owner uses them, until I use one', () => {
    const sections = templateSections(
      [
        template({ id: 'fresh', mine: false, ownerLastUsedAt: daysAgo(5) }),
        template({ id: 'dusty', mine: false, ownerLastUsedAt: daysAgo(100) }),
        template({ id: 'used', mine: false, myLastUsedAt: daysAgo(3) }),
        template({ id: 'theirs-archived', mine: false, archivedAt: daysAgo(1) }),
      ],
      NOW,
    );
    expect(sections.group.map((t) => t.id)).toEqual(['fresh']);
    expect(sections.active.map((t) => t.id)).toEqual(['used']);
    expect(sections.archived).toHaveLength(0);
  });

  it('filters by training type when starting', () => {
    const sections = templateSections(
      [template({ id: 's' }), template({ id: 'h', trainingTypeId: 'home' })],
      NOW,
      'home',
    );
    expect(sections.active.map((t) => t.id)).toEqual(['h']);
  });
});

describe('findSimilarTemplate', () => {
  it('finds a template with the same exercises in the same order', () => {
    const candidates = [
      { id: 't1', exerciseIds: ['a', 'b'] },
      { id: 't2', exerciseIds: ['a', 'b', 'c'] },
    ];
    expect(findSimilarTemplate(['a', 'b', 'c'], candidates)).toBe('t2');
    expect(findSimilarTemplate(['b', 'a'], candidates)).toBeNull();
  });
});

describe('suggestTemplateName', () => {
  it('combines focus and training type', () => {
    expect(suggestTemplateName('Push', 'Studio')).toBe('Push · Studio');
    expect(suggestTemplateName(null, 'Home Gym')).toBe('Home Gym');
  });
});
