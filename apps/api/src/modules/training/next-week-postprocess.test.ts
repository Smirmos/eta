import { describe, expect, it } from 'vitest';
import type { NextWeekFrame, WeeklyDetail } from '@eta/shared-types';
import { NextWeekGuardError, validateNextWeekVolume } from './next-week-postprocess.js';

function frame(over: Partial<NextWeekFrame> = {}): NextWeekFrame {
  return {
    weekStartDate: '2026-07-06', phase: 'build_1', isRecoveryWeek: false, targetVolumeHours: 12,
    days: [
      { dayOfWeek: 'tue', role: 'quality', disciplines: ['bike'], targetDurationMinutes: 60 },
      { dayOfWeek: 'thu', role: 'quality', disciplines: ['run'], targetDurationMinutes: 60 },
    ] as NextWeekFrame['days'],
    rationale: { weeksUntilRace: 8, volumeAnchorHours: 11.5, rampPct: 0.08, easeTriggered: false },
    ...over,
  };
}

function detail(totalHours: number, hardCount = 0): WeeklyDetail {
  const workouts = [];
  // one workout carrying `totalHours`, plus `hardCount` short z4 workouts.
  workouts.push({
    workoutCode: 'B/AE1', discipline: 'bike', date: '2026-07-11',
    totalDurationSeconds: Math.round(totalHours * 3600),
    segments: [{ label: 'M', durationSeconds: Math.round(totalHours * 3600), zone: 'z2', description: '' }],
    rationale: 'x', citation: 'knowledge-base/03-workouts.md#x',
  });
  for (let i = 0; i < hardCount; i++) {
    workouts.push({
      workoutCode: 'B/SS2', discipline: 'bike', date: '2026-07-07',
      totalDurationSeconds: 600,
      segments: [{ label: 'M', durationSeconds: 600, zone: 'z4', description: '' }],
      rationale: 'x', citation: 'knowledge-base/03-workouts.md#x',
    });
  }
  return { weekNumber: 1, weekStartDate: '2026-07-06', phase: 'build_1', workouts } as WeeklyDetail;
}

describe('validateNextWeekVolume', () => {
  it('passes when total hours are within ±10% of target', () => {
    expect(() => validateNextWeekVolume(detail(12.5), frame())).not.toThrow();
  });

  it('throws when total hours are >10% off target', () => {
    expect(() => validateNextWeekVolume(detail(20), frame())).toThrow(NextWeekGuardError);
  });

  it('throws when hard sessions exceed the phase allowance + 1', () => {
    // frame has 2 quality days → allowance 2, +1 tolerance = 3; 4 hard → throws.
    expect(() => validateNextWeekVolume(detail(12, 4), frame())).toThrow(NextWeekGuardError);
  });
});
