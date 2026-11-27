import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, useSearchParams } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { todayKey } from '../dates';
import type { Habit, HabitDay } from '../types';
import { CheckIn } from './CheckIn';

const habit: Habit = {
  id: 'habit-1',
  templateId: null,
  archived: false,
  shareLevel: 'private',
  userId: 'user-1',
  sourceHabitId: null,
  since: '2026-11-01',
  current: {
    name: 'Kein Alkohol',
    inputType: 'yes_no',
    unit: null,
    rule: [],
    frequency: 'daily',
    weekdays: [],
    timesPerWeek: null,
    timeOfDay: 'evening',
    options: [],
    source: 'manual',
  },
};

const day: HabitDay = {
  habitId: habit.id,
  onDate: todayKey(),
  name: habit.current.name,
  inputType: 'yes_no',
  frequency: 'daily',
  source: 'manual',
  timeOfDay: 'evening',
  due: true,
  paused: false,
  value: null,
  state: 'open',
};

vi.mock('../api/useHabits', () => ({
  useMyHabits: () => ({ data: [habit] }),
  useHabitDays: () => ({ data: [day] }),
  useHabitWeeks: () => ({ data: [] }),
  useSetHabitEntry: () => ({ mutate: vi.fn() }),
}));

// jsdom has no ResizeObserver; the sheet only uses it to follow its content's height.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

/** Heute as the app wires it: the link's habit goes in, opening clears the link. */
function Today() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  return (
    <>
      <output data-testid="search">{location.search}</output>
      <CheckIn
        openHabitId={params.get('checkin')}
        onOpened={() => {
          setParams({}, { replace: true });
        }}
      />
    </>
  );
}

describe('CheckIn from a reminder link', () => {
  it('opens at the habit, clears the link and stays closed once closed', async () => {
    render(
      <MemoryRouter initialEntries={['/?checkin=habit-1']}>
        <Today />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('search')).toHaveTextContent(/^$/);
    });

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    // Give a reopening render the chance to happen.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
