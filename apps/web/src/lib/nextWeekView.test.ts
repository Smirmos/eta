import { groupByDiscipline, sessionType, formatHours } from './nextWeekView.js';
import type { NextWeekFrame, PlannedWorkout } from '@eta/shared-types';

const wk = (over: Partial<PlannedWorkout>): PlannedWorkout => ({
  workoutCode: 'B/AE1', discipline: 'bike', date: '2026-07-06', totalDurationSeconds: 3600,
  segments: [], rationale: 'r', citation: 'c', ...over,
});

const frame = (): NextWeekFrame => ({
  weekStartDate: '2026-07-06', phase: 'build_1', isRecoveryWeek: false, targetVolumeHours: 12.5,
  days: [
    { dayOfWeek: 'mon', role: 'rest', disciplines: [], targetDurationMinutes: 0 },
    { dayOfWeek: 'tue', role: 'quality', disciplines: ['bike'], targetDurationMinutes: 75 },
    { dayOfWeek: 'wed', role: 'aerobic', disciplines: ['swim'], targetDurationMinutes: 60 },
    { dayOfWeek: 'thu', role: 'recovery', disciplines: ['run'], targetDurationMinutes: 40 },
    { dayOfWeek: 'fri', role: 'long', disciplines: ['run'], targetDurationMinutes: 90 },
    { dayOfWeek: 'sat', role: 'aerobic', disciplines: ['swim'], targetDurationMinutes: 60 },
    { dayOfWeek: 'sun', role: 'long', disciplines: ['bike'], targetDurationMinutes: 180 },
  ],
  rationale: { weeksUntilRace: 8, volumeAnchorHours: 11.6, rampPct: 0.08, easeTriggered: false },
});

test('groupByDiscipline orders swim,bike,run and omits empty disciplines', () => {
  const groups = groupByDiscipline([
    wk({ discipline: 'bike', totalDurationSeconds: 3600 }),
    wk({ discipline: 'swim', totalDurationSeconds: 1800 }),
    wk({ discipline: 'bike', totalDurationSeconds: 5400 }),
  ]);
  expect(groups.map((g) => g.discipline)).toEqual(['swim', 'bike']); // no run → omitted
  const bike = groups.find((g) => g.discipline === 'bike')!;
  expect(bike.sessionCount).toBe(2);
  expect(bike.totalSeconds).toBe(9000);
});

test('sessionType joins date to day role', () => {
  expect(sessionType(wk({ discipline: 'bike', date: '2026-07-12' }), frame())).toBe('Long ride'); // sun/long
  expect(sessionType(wk({ discipline: 'run', date: '2026-07-10' }), frame())).toBe('Long run'); // fri/long
  expect(sessionType(wk({ discipline: 'bike', date: '2026-07-07' }), frame())).toBe('Threshold / quality'); // tue/quality
  expect(sessionType(wk({ discipline: 'swim', date: '2026-07-08' }), frame())).toBe('Aerobic'); // wed/aerobic
  expect(sessionType(wk({ discipline: 'run', date: '2026-07-09' }), frame())).toBe('Recovery'); // thu/recovery
});

test('sessionType falls back to workoutCode when the date is off-week', () => {
  expect(sessionType(wk({ workoutCode: 'B/AC1', date: '2030-01-01' }), frame())).toBe('B/AC1');
});

test('formatHours renders whole and half hours', () => {
  expect(formatHours(10800)).toBe('3h');
  expect(formatHours(9000)).toBe('2.5h');
});
