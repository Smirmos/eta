import { test, expect } from 'vitest';
import { TrainingAnalysisService } from './training-analysis.service.js';

type Row = { date: string; discipline: string; actualDurationSeconds: number | null; actualTss: string | null };

function repoWith(rows: Row[]) {
  return { findByUserAndDateRange: async () => rows } as never;
}

const today = new Date('2026-06-29T00:00:00Z');

test('returns empty analysis when there are no rows', async () => {
  const svc = new TrainingAnalysisService(repoWith([]));
  const a = await svc.analyze('u1', today);
  expect(a.hasData).toBe(false);
  expect(a.window).toBeNull();
  expect(a.overall.totalSessions).toBe(0);
});

test('anchors the window to the most recent activity and computes overall metrics', async () => {
  const rows: Row[] = [
    { date: '2026-06-15', discipline: 'bike', actualDurationSeconds: 3600, actualTss: '60' },
    { date: '2026-06-14', discipline: 'run', actualDurationSeconds: 1800, actualTss: null },
    { date: '2026-06-14', discipline: 'swim', actualDurationSeconds: 1800, actualTss: null },
    { date: '2026-04-01', discipline: 'run', actualDurationSeconds: 3600, actualTss: null }, // outside 28-day window
  ];
  const svc = new TrainingAnalysisService(repoWith(rows));
  const a = await svc.analyze('u1', today);
  expect(a.hasData).toBe(true);
  expect(a.window).toEqual({ from: '2026-05-19', asOf: '2026-06-15' });
  expect(a.overall.totalSessions).toBe(3); // the 04-01 row is excluded
  expect(a.overall.totalHours).toBe(2); // 1h + 0.5h + 0.5h
  expect(a.overall.trainingDays).toBe(2); // 06-15, 06-14
  expect(a.dataNote.staleDays).toBe(14); // 06-29 - 06-15
});

test('computes sport split and bike-only TSS', async () => {
  const rows: Row[] = [
    { date: '2026-06-15', discipline: 'bike', actualDurationSeconds: 3600, actualTss: '60' },
    { date: '2026-06-15', discipline: 'run', actualDurationSeconds: 3600, actualTss: null },
  ];
  const svc = new TrainingAnalysisService(repoWith(rows));
  const a = await svc.analyze('u1', today);
  const bike = a.overall.sportSplit.find((s) => s.discipline === 'bike');
  expect(bike?.pctHours).toBe(50);
  expect(a.perWeek.at(-1)?.bikeTss).toBe(60);
});

test('classifies trend as tapering when the latest week is much lighter', async () => {
  const rows: Row[] = [
    // older week (bucket -4..-3 weeks): heavy
    { date: '2026-05-20', discipline: 'run', actualDurationSeconds: 36000, actualTss: null },
    // latest week: light
    { date: '2026-06-15', discipline: 'run', actualDurationSeconds: 1800, actualTss: null },
  ];
  const svc = new TrainingAnalysisService(repoWith(rows));
  const a = await svc.analyze('u1', today);
  expect(a.trend).toBe('tapering');
});

test('reports the longest session per sport', async () => {
  const rows: Row[] = [
    { date: '2026-06-10', discipline: 'bike', actualDurationSeconds: 7200, actualTss: '120' },
    { date: '2026-06-12', discipline: 'bike', actualDurationSeconds: 3600, actualTss: '60' },
  ];
  const svc = new TrainingAnalysisService(repoWith(rows));
  const a = await svc.analyze('u1', today);
  expect(a.longestSessions.find((l) => l.discipline === 'bike')).toEqual({ discipline: 'bike', date: '2026-06-10', minutes: 120 });
});
