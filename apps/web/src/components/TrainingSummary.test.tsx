import { render, screen } from '@testing-library/react';
import { makeAnalysisFixture } from '../test/fixtures/analysis.fixture.js';
import { TrainingSummary } from './TrainingSummary.js';

test('renders headline stats and window', () => {
  render(<TrainingSummary analysis={makeAnalysisFixture()} />);
  expect(screen.getByText(/40\.5/)).toBeInTheDocument(); // total hours
  expect(screen.getByText(/2026-06-15/)).toBeInTheDocument(); // asOf
});

test('renders the narrative when present', () => {
  render(<TrainingSummary analysis={makeAnalysisFixture()} />);
  expect(screen.getByText(/consistent four weeks/i)).toBeInTheDocument();
});

test('shows a staleness note when data is old', () => {
  render(<TrainingSummary analysis={makeAnalysisFixture()} />);
  expect(screen.getByText(/14 days old/i)).toBeInTheDocument();
});

test('shows an empty state when there is no data', () => {
  render(<TrainingSummary analysis={makeAnalysisFixture({ hasData: false, window: null, narrative: null })} />);
  expect(screen.getByText(/no recent training/i)).toBeInTheDocument();
});
