import { render, screen } from '@testing-library/react';
import { makePlanTreeFixture } from '../test/fixtures/plan-tree.fixture.js';
import { WeekOverview } from './WeekOverview.js';

test('lists weeks and marks the current one', () => {
  const weeks = makePlanTreeFixture().weeks;
  render(<WeekOverview weeks={weeks} currentIndex={0} />);
  const links = screen.getAllByRole('link');
  expect(links).toHaveLength(2);
  expect(links[0]).toHaveAttribute('href', '#week-2');
  expect(links[0]).toHaveAttribute('aria-current', 'true');
});
