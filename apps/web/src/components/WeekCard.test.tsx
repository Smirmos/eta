import { render, screen } from '@testing-library/react';
import { makePlanTreeFixture } from '../test/fixtures/plan-tree.fixture.js';
import { WeekCard } from './WeekCard.js';

test('renders workouts when a detail exists', () => {
  const week = makePlanTreeFixture().weeks[0]!;
  render(<WeekCard week={week} isCurrent={true} />);
  expect(screen.getByText('B/AE2')).toBeInTheDocument();
  expect(screen.getByText(/aerobic base/i)).toBeInTheDocument();
});

test('renders a placeholder when no detail exists', () => {
  const week = makePlanTreeFixture().weeks[1]!;
  render(<WeekCard week={week} isCurrent={false} />);
  expect(screen.getByText(/No detailed workouts/)).toBeInTheDocument();
});
