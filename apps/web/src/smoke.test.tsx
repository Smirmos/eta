import { render, screen } from '@testing-library/react';
import { App } from './App.js';

test('App renders a heading', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'ETA' })).toBeInTheDocument();
});
