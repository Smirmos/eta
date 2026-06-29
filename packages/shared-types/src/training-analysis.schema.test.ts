import { expect, test } from 'vitest';
import { trainingAnalysisResponseSchema } from './training-analysis.schema.js';

const valid = {
  hasData: true,
  window: { from: '2026-05-19', asOf: '2026-06-15' },
  overall: {
    totalSessions: 30,
    totalHours: 40.5,
    trainingDays: 18,
    avgSessionsPerWeek: 7.5,
    avgTrainingDaysPerWeek: 4.5,
    sportSplit: [{ discipline: 'bike', sessions: 12, hours: 18.2, pctHours: 45 }],
  },
  perWeek: [
    { weekStart: '2026-05-19', sessions: 8, hours: 10.1, byDiscipline: { bike: { sessions: 3, hours: 4.2 } }, bikeTss: 180 },
  ],
  trend: 'steady',
  longestSessions: [{ discipline: 'bike', date: '2026-06-10', minutes: 180 }],
  dataNote: { tssCoverage: 'bike_only', staleDays: 14 },
  narrative: 'Solid block.',
};

test('accepts a valid response', () => {
  expect(trainingAnalysisResponseSchema.safeParse(valid).success).toBe(true);
});

test('accepts a null narrative and null window', () => {
  expect(trainingAnalysisResponseSchema.safeParse({ ...valid, narrative: null, window: null }).success).toBe(true);
});

test('rejects an invalid trend', () => {
  expect(trainingAnalysisResponseSchema.safeParse({ ...valid, trend: 'sideways' }).success).toBe(false);
});

test('accepts byDiscipline with only one discipline key (partial is allowed)', () => {
  const partial = {
    ...valid,
    perWeek: [{ ...valid.perWeek[0], byDiscipline: { bike: { sessions: 2, hours: 3 } } }],
  };
  expect(trainingAnalysisResponseSchema.safeParse(partial).success).toBe(true);
});
