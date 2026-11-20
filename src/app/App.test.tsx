import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('shows the login screen when signed out', async () => {
    render(<App />);
    expect(await screen.findByRole('button', { name: /mit google anmelden/i })).toBeInTheDocument();
  });
});
