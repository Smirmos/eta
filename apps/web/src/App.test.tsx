import { render, screen, waitFor } from '@testing-library/react';
import { makeAnalysisFixture } from './test/fixtures/analysis.fixture.js';
import type { AnalysisResult } from './api/analysis.js';
import { App } from './App.js';

const ok = (): Promise<AnalysisResult> => Promise.resolve({ status: 'ok', analysis: makeAnalysisFixture() });

test('renders the training summary on success', async () => {
  render(<App fetchAnalysisImpl={ok} />);
  await waitFor(() => expect(screen.getByText('Training summary')).toBeInTheDocument());
  expect(screen.getByText(/40\.5/)).toBeInTheDocument();
});

test('shows the error state with a retry button', async () => {
  render(<App fetchAnalysisImpl={() => Promise.resolve({ status: 'error', message: 'boom' })} />);
  await waitFor(() => expect(screen.getByText(/boom/)).toBeInTheDocument());
  expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
});

test('renders with the default fetcher without an update-depth loop', async () => {
  const analysis = makeAnalysisFixture();
  const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => analysis }) as Response) as unknown as typeof fetch;
  vi.stubGlobal('fetch', fetchMock);
  try {
    render(<App />);
    await waitFor(() => expect(screen.getByText('Training summary')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  } finally {
    vi.unstubAllGlobals();
  }
});
