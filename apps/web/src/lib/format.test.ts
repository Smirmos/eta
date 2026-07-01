import { formatDuration } from './format.js';

test('formats hours and minutes', () => {
  expect(formatDuration(3600)).toBe('1h');
  expect(formatDuration(3900)).toBe('1h 5m');
  expect(formatDuration(1800)).toBe('30m');
  expect(formatDuration(0)).toBe('0m');
});
