import { render, screen } from '@testing-library/react';
import { makePlanTreeFixture } from '../test/fixtures/plan-tree.fixture.js';
import { AdaptationCard } from './AdaptationCard.js';

test('renders adjustments with reasoning', () => {
  const { currentAdaptation } = makePlanTreeFixture();
  render(<AdaptationCard adaptation={currentAdaptation} />);
  expect(screen.getByText(/reduce load/i)).toBeInTheDocument();
  expect(screen.getByText('modify')).toBeInTheDocument();
});

test('renders nothing when adaptation is null', () => {
  const { container } = render(<AdaptationCard adaptation={null} />);
  expect(container).toBeEmptyDOMElement();
});
