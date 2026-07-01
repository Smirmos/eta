import { makeAnalysisFixture } from '../test/fixtures/analysis.fixture.js';
import { deriveInsights } from './insights.js';

const ids = (analysis = makeAnalysisFixture()): string[] => deriveInsights(analysis).map((i) => i.id);

test('flags an undertrained discipline below the balance threshold', () => {
  // fixture: swim is 11% of volume
  const swim = deriveInsights(makeAnalysisFixture()).find((i) => i.id === 'undertrained:swim');
  expect(swim).toBeDefined();
  expect(swim?.tone).toBe('watch');
  expect(swim?.detail).toMatch(/11%/);
});

test('flags the bike-only TSS blind spot as a watch-out', () => {
  expect(ids()).toContain('tss-coverage');
  const tss = deriveInsights(makeAnalysisFixture()).find((i) => i.id === 'tss-coverage');
  expect(tss?.tone).toBe('watch');
});

test('flags stale data when staleDays exceeds a week', () => {
  expect(ids()).toContain('stale'); // fixture staleDays = 14
  expect(ids(makeAnalysisFixture({ dataNote: { tssCoverage: 'bike_only', staleDays: 2 } }))).not.toContain('stale');
});

test('treats >=4 training days/week as a consistency strength', () => {
  // fixture: 4.5 days/week
  const c = deriveInsights(makeAnalysisFixture()).find((i) => i.id === 'consistency');
  expect(c?.tone).toBe('strength');
  expect(c?.detail).toMatch(/4\.5/);
  expect(ids(makeAnalysisFixture({ overall: { ...makeAnalysisFixture().overall, avgTrainingDaysPerWeek: 2.5 } }))).not.toContain('consistency');
});

test('reports a building trend as a strength and tapering as a watch', () => {
  expect(deriveInsights(makeAnalysisFixture({ trend: 'building' })).find((i) => i.id === 'trend')?.tone).toBe('strength');
  expect(deriveInsights(makeAnalysisFixture({ trend: 'tapering' })).find((i) => i.id === 'trend')?.tone).toBe('watch');
  expect(ids(makeAnalysisFixture({ trend: 'steady' }))).not.toContain('trend');
});

test('reports a solid aerobic base above the hours threshold', () => {
  // fixture: 40.5h
  expect(deriveInsights(makeAnalysisFixture()).find((i) => i.id === 'aerobic-base')?.tone).toBe('strength');
  expect(ids(makeAnalysisFixture({ overall: { ...makeAnalysisFixture().overall, totalHours: 12 } }))).not.toContain('aerobic-base');
});

test('flags a missing discipline distinctly from an undertrained one', () => {
  const noSwim = makeAnalysisFixture({
    overall: {
      ...makeAnalysisFixture().overall,
      sportSplit: [
        { discipline: 'bike', sessions: 12, hours: 18.2, pctHours: 50 },
        { discipline: 'run', sessions: 15, hours: 18.0, pctHours: 50 },
      ],
    },
  });
  const got = ids(noSwim);
  expect(got).toContain('missing:swim');
  expect(got).not.toContain('undertrained:swim');
});

test('always returns at least one strength and one watch for a real training block', () => {
  const insights = deriveInsights(makeAnalysisFixture());
  expect(insights.some((i) => i.tone === 'strength')).toBe(true);
  expect(insights.some((i) => i.tone === 'watch')).toBe(true);
});
