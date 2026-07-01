import { render, screen } from '@testing-library/react';
import { makeAnalysisFixture } from '../test/fixtures/analysis.fixture.js';
import { TrainingSummary } from './TrainingSummary.js';

test('renders headline stats and window', () => {
  render(<TrainingSummary analysis={makeAnalysisFixture()} />);
  expect(screen.getAllByText(/40\.5/).length).toBeGreaterThan(0); // total hours
  expect(screen.getAllByText(/2026-06-15/).length).toBeGreaterThan(0); // asOf
});

test('renders titled sport-balance and weekly panels', () => {
  render(<TrainingSummary analysis={makeAnalysisFixture()} />);
  expect(screen.getByText(/sport balance/i)).toBeInTheDocument();
  expect(screen.getByText(/weekly volume/i)).toBeInTheDocument();
});

test('surfaces strengths and watch-outs derived from the analysis', () => {
  render(<TrainingSummary analysis={makeAnalysisFixture()} />);
  expect(screen.getByText(/watch-outs/i)).toBeInTheDocument();
  expect(screen.getByText(/strengths/i)).toBeInTheDocument();
  // fixture: swim is 11% of volume → flagged as light
  expect(screen.getByText(/swim is light/i)).toBeInTheDocument();
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
