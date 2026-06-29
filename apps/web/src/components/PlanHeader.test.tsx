import { render, screen } from '@testing-library/react';
import { makePlanTreeFixture } from '../test/fixtures/plan-tree.fixture.js';
import { PlanHeader } from './PlanHeader.js';

test('shows race date and plan id', () => {
  render(<PlanHeader tree={makePlanTreeFixture()} />);
  expect(screen.getByText('2026-07-13')).toBeInTheDocument();
  expect(screen.getByText('plan-1')).toBeInTheDocument();
});
