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

// Regression: the production path renders <App /> with NO fetchTree prop, so the
// default fetcher is used. If that default has an unstable identity across
// renders, the mount effect re-fires endlessly ("Maximum update depth
// exceeded"). This exercises that path via a stubbed global fetch.
test('renders with the default fetcher without an update-depth loop', async () => {
  const tree = makePlanTreeFixture();
  const fetchMock = vi.fn(
    async () => ({ ok: true, status: 200, json: async () => tree }) as Response,
  ) as unknown as typeof fetch;
  vi.stubGlobal('fetch', fetchMock);
  try {
    render(<App />);
    await waitFor(() => expect(screen.getByText('2026-07-13')).toBeInTheDocument());
    // A render loop would call fetch far more than the single mount fetch.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  } finally {
    vi.unstubAllGlobals();
  }
});
