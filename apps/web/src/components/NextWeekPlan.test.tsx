import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { makeNextWeekFixture } from '../test/fixtures/next-week.fixture.js';
import type { NextWeekResult } from '../api/next-week.js';
import { NextWeekPlan } from './NextWeekPlan.js';

const ok = (): Promise<NextWeekResult> => Promise.resolve({ status: 'loaded', response: makeNextWeekFixture() });

test('shows a Generate button and renders the week after clicking', async () => {
  render(<NextWeekPlan fetchNextWeekImpl={ok} />);
  const btn = screen.getByRole('button', { name: /generate next week/i });
  fireEvent.click(btn);
  await waitFor(() => expect(screen.getByText(/build_1/i)).toBeInTheDocument());
  expect(screen.getAllByText(/12\.5/).length).toBeGreaterThan(0); // target volume in the "why" strip
});

test('renders the needs_profile prompt', async () => {
  const needsProfile = (): Promise<NextWeekResult> => Promise.resolve({ status: 'loaded', response: { status: 'needs_profile' } });
  render(<NextWeekPlan fetchNextWeekImpl={needsProfile} />);
  fireEvent.click(screen.getByRole('button', { name: /generate next week/i }));
  await waitFor(() => expect(screen.getByText(/profile/i)).toBeInTheDocument());
});

test('calls the fetcher exactly once per click (no render loop)', async () => {
  const spy = vi.fn(ok);
  render(<NextWeekPlan fetchNextWeekImpl={spy} />);
  fireEvent.click(screen.getByRole('button', { name: /generate next week/i }));
  await waitFor(() => expect(screen.getByText(/build_1/i)).toBeInTheDocument());
  expect(spy).toHaveBeenCalledTimes(1);
});
