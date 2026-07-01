import type { NextWeekResponse } from '@eta/shared-types';

export function makeNextWeekFixture(): Extract<NextWeekResponse, { status: 'ok' }> {
  return {
    status: 'ok',
    frame: {
      weekStartDate: '2026-07-06', phase: 'build_1', isRecoveryWeek: false, targetVolumeHours: 12.5,
      days: [
        { dayOfWeek: 'mon', role: 'rest', disciplines: [], targetDurationMinutes: 0 },
        { dayOfWeek: 'tue', role: 'quality', disciplines: ['bike'], targetDurationMinutes: 75 },
        { dayOfWeek: 'wed', role: 'aerobic', disciplines: ['swim'], targetDurationMinutes: 60 },
        { dayOfWeek: 'thu', role: 'quality', disciplines: ['run'], targetDurationMinutes: 60 },
        { dayOfWeek: 'fri', role: 'long', disciplines: ['run'], targetDurationMinutes: 90 },
        { dayOfWeek: 'sat', role: 'aerobic', disciplines: ['swim'], targetDurationMinutes: 60 },
        { dayOfWeek: 'sun', role: 'long', disciplines: ['bike'], targetDurationMinutes: 180 },
      ],
      rationale: { weeksUntilRace: 8, volumeAnchorHours: 11.6, rampPct: 0.08, easeTriggered: false },
    },
    weeklyDetail: {
      weekNumber: 1, weekStartDate: '2026-07-06', phase: 'build_1', weeklyTotalHours: 12.5,
      workouts: [
        {
          workoutCode: 'B/T1', discipline: 'swim', date: '2026-07-08', totalDurationSeconds: 3600,
          segments: [
            { label: 'Warmup', durationSeconds: 600, zone: 'z1', description: 'Easy swim + drills' },
            { label: 'Main set', durationSeconds: 2400, zone: 'z3', description: '8x100 at threshold' },
            { label: 'Cooldown', durationSeconds: 600, zone: 'z1', description: 'Easy swim' },
          ],
          rationale: 'Threshold swim to hold CSS pace.', citation: 'knowledge-base/03-workouts.md#b-t1',
        },
        {
          workoutCode: 'C/AE1', discipline: 'bike', date: '2026-07-12', totalDurationSeconds: 10800,
          segments: [
            { label: 'Warmup', durationSeconds: 600, zone: 'z1', description: 'Easy spin' },
            { label: 'Main', durationSeconds: 9600, zone: 'z2', description: 'Steady aerobic' },
            { label: 'Cooldown', durationSeconds: 600, zone: 'z1', description: 'Easy spin' },
          ],
          rationale: 'Long aerobic ride to build the bike base.', citation: 'knowledge-base/03-workouts.md#c-ae1',
        },
        {
          workoutCode: 'D/AE1', discipline: 'run', date: '2026-07-09', totalDurationSeconds: 2400,
          segments: [
            { label: 'Steady', durationSeconds: 2400, zone: 'z1', description: 'Easy conversational run' },
          ],
          rationale: 'Recovery run to flush the legs.', citation: 'knowledge-base/03-workouts.md#d-ae1',
        },
      ],
    },
  };
}
