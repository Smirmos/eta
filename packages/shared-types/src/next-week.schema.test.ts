import { describe, expect, it } from 'vitest';
import { nextWeekResponseSchema } from './next-week.schema.js';

describe('nextWeekResponseSchema', () => {
  it('parses a needs_profile response', () => {
    expect(nextWeekResponseSchema.parse({ status: 'needs_profile' })).toEqual({ status: 'needs_profile' });
  });

  it('rejects an ok response missing the frame', () => {
    const r = nextWeekResponseSchema.safeParse({ status: 'ok', weeklyDetail: {} });
    expect(r.success).toBe(false);
  });

  it('requires exactly 7 days in a frame', () => {
    const frame = {
      weekStartDate: '2026-07-06', phase: 'build_1', isRecoveryWeek: false, targetVolumeHours: 12,
      days: [], rationale: { weeksUntilRace: 8, volumeAnchorHours: 11, rampPct: 0.08, easeTriggered: false },
    };
    expect(nextWeekFrameOnly(frame)).toBe(false);
  });
});

function nextWeekFrameOnly(frame: unknown): boolean {
  return nextWeekResponseSchema.safeParse({
    status: 'ok', frame, weeklyDetail: { weekNumber: 1, weekStartDate: '2026-07-06', phase: 'build_1', workouts: [] },
  }).success;
}
