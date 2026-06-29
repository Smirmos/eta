import type { TrainingAnalysisResponse } from '@eta/shared-types';

const base: TrainingAnalysisResponse = {
  hasData: true,
  window: { from: '2026-05-19', asOf: '2026-06-15' },
  overall: {
    totalSessions: 30,
    totalHours: 40.5,
    trainingDays: 18,
    avgSessionsPerWeek: 7.5,
    avgTrainingDaysPerWeek: 4.5,
    sportSplit: [
      { discipline: 'bike', sessions: 12, hours: 18.2, pctHours: 45 },
      { discipline: 'run', sessions: 15, hours: 18.0, pctHours: 44 },
      { discipline: 'swim', sessions: 3, hours: 4.3, pctHours: 11 },
    ],
  },
  perWeek: [
    { weekStart: '2026-05-19', sessions: 6, hours: 7.1, byDiscipline: { bike: { sessions: 2, hours: 3 } }, bikeTss: 120 },
    { weekStart: '2026-05-26', sessions: 9, hours: 12.9, byDiscipline: { run: { sessions: 4, hours: 5 } }, bikeTss: 180 },
    { weekStart: '2026-06-02', sessions: 9, hours: 10.2, byDiscipline: { swim: { sessions: 1, hours: 1 } }, bikeTss: null },
    { weekStart: '2026-06-09', sessions: 6, hours: 10.3, byDiscipline: { bike: { sessions: 3, hours: 5 } }, bikeTss: 200 },
  ],
  trend: 'steady',
  longestSessions: [
    { discipline: 'bike', date: '2026-06-10', minutes: 180 },
    { discipline: 'run', date: '2026-06-05', minutes: 95 },
  ],
  dataNote: { tssCoverage: 'bike_only', staleDays: 14 },
  narrative: 'A consistent four weeks across all three sports.',
};

export function makeAnalysisFixture(
  overrides: Partial<TrainingAnalysisResponse> = {},
): TrainingAnalysisResponse {
  return { ...structuredClone(base), ...overrides };
}
