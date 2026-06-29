import { render, screen, waitFor } from '@testing-library/react';
import { makePlanTreeFixture } from './test/fixtures/plan-tree.fixture.js';
import type { FetchResult } from './api/fetch-plan-tree.js';
import { App } from './App.js';

const ok = (): Promise<FetchResult> =>
  Promise.resolve({ status: 'ok', tree: makePlanTreeFixture() });

test('renders the plan on success', async () => {
  render(<App fetchTree={ok} />);
  await waitFor(() => expect(screen.getByText('2026-07-13')).toBeInTheDocument());
  expect(screen.getAllByText('B/AE2').length).toBeGreaterThan(0);
});

test('shows the empty state on 404', async () => {
  render(<App fetchTree={() => Promise.resolve({ status: 'empty' })} />);
  await waitFor(() => expect(screen.getByText(/no plan yet/i)).toBeInTheDocument());
});

test('shows the error state with a retry button', async () => {
  render(<App fetchTree={() => Promise.resolve({ status: 'error', message: 'boom' })} />);
  await waitFor(() => expect(screen.getByText(/boom/)).toBeInTheDocument());
  expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
});
