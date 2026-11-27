import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Goal } from '../types';
import { GoalsOverview } from './GoalsOverview';

const goals: { data: Goal[] } = { data: [] };

const weight: Goal = {
  id: 'g1',
  userId: 'u1',
  metric: 'body_weight',
  metricLabel: 'Körpergewicht',
  metricKind: 'level',
  unit: 'kg',
  reference: { exerciseId: null, deviceId: null, habitId: null, measurementKind: null },
  referenceLabel: null,
  referenceDetail: null,
  reps: null,
  startsOn: '2026-10-26',
  endsOn: '2099-02-18',
  visibility: 'private',
  archivedAt: null,
  createdAt: '2026-10-26T10:00:00Z',
  valuesHidden: false,
  evaluatedOn: '2026-11-27',
  phase: 'running',
  startValue: 86,
  minValue: 82,
  targetValue: 80,
  currentValue: 85.7,
  currentOn: '2026-11-27',
  expectedValue: 84.3,
  progressPct: 5,
  status: 'below_min',
  onTrack: false,
  counted: null,
  minMet: null,
  targetMet: null,
  countUnit: null,
  thisWeek: null,
  bestSet: null,
};

const mutation = { mutate: vi.fn() };
vi.mock('../api/useGoals', () => ({
  useGoals: () => ({ ...goals, isPending: false, isError: false }),
  useGoalMetrics: () => ({ data: [] }),
  useGoalReferenceOptions: () => ({ data: [], isPending: false }),
  useGoalStartSuggestion: () => ({ data: undefined }),
  useGoalHistory: () => ({ data: [], isPending: false }),
  useCreateGoal: () => mutation,
  useUpdateGoal: () => mutation,
  useArchiveGoal: () => mutation,
  useDiscardGoal: () => mutation,
  useRestoreGoal: () => mutation,
}));

describe('GoalsOverview', () => {
  it('invites to the first goal', () => {
    goals.data = [];
    render(<GoalsOverview />);
    expect(screen.getByText('Noch kein Ziel')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Neues Ziel/ })).toBeTruthy();
  });

  it('shows a goal with start, now and target, its status and the ended row', () => {
    goals.data = [
      weight,
      { ...weight, id: 'g2', archivedAt: '2026-11-20T10:00:00Z', status: 'min_reached' },
    ];
    render(<GoalsOverview header={<p>Saison</p>} />);
    expect(screen.getByText('Saison')).toBeTruthy();
    expect(screen.getAllByText('Körpergewicht')).toHaveLength(1);
    expect(screen.getByText('85,7')).toBeTruthy();
    expect(screen.getByText(/Mindestziel noch nicht erreicht/)).toBeTruthy();
    expect(screen.getByText(/Hinter Plan/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Beendet/ }).textContent).toContain('1');
  });

  it('marks goals of a frame, lists them first, and opens a locked one without changes', () => {
    // The detail's chart measures itself.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    goals.data = [
      weight,
      { ...weight, id: 'g2', metric: 'trainings_per_week', metricLabel: 'Trainings pro Woche' },
    ];
    const onGoalOpened = vi.fn();
    render(
      <GoalsOverview
        frameOf={(goal) =>
          goal.id === 'g2'
            ? {
                tag: 'Saison',
                name: 'Saison „Winter“',
                periodFixed: true,
                lockedNote: 'Seit dem Saisonstart fest. Änderungen nur durch den Admin.',
              }
            : null
        }
        openGoalId="g2"
        onGoalOpened={onGoalOpened}
      />,
    );
    // Earlier renders stay in the document: look at the cards' titles only.
    const titles = [...document.querySelectorAll('ul button span.text-body.font-semibold')].map(
      (e) => e.textContent,
    );
    expect(titles.slice(-2)).toEqual(['Trainings pro Woche', 'Körpergewicht']);
    expect(screen.getAllByText('Saison').length).toBeGreaterThan(0);
    expect(screen.getByText(/Seit dem Saisonstart fest/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Bearbeiten' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ziel beenden' })).toBeNull();
    expect(onGoalOpened).toHaveBeenCalled();
  });
});
