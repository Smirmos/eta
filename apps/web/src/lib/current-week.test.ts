import { makePlanTreeFixture } from '../test/fixtures/plan-tree.fixture.js';
import { indexOfCurrentWeek } from './current-week.js';

const weeks = makePlanTreeFixture().weeks;

test('finds the week containing today', () => {
  expect(indexOfCurrentWeek(weeks, new Date('2026-06-30T12:00:00Z'))).toBe(0);
  expect(indexOfCurrentWeek(weeks, new Date('2026-07-07T00:00:00Z'))).toBe(1);
});

test('returns the last index when today is past the plan', () => {
  expect(indexOfCurrentWeek(weeks, new Date('2026-09-01T00:00:00Z'))).toBe(1);
});

test('returns -1 for an empty plan', () => {
  expect(indexOfCurrentWeek([], new Date('2026-06-30T00:00:00Z'))).toBe(-1);
});
