import { describe, expect, it } from 'vitest';
import type { WorkoutCompleted } from './workout-completed.js';
import { workoutCompletedSchema } from './workout-completed.schema.js';

const valid = (overrides: Partial<WorkoutCompleted> = {}): WorkoutCompleted => ({
  date: '2026-06-01',
  workoutCode: 'C/AE2',
  ...overrides,
});

describe('workoutCompletedSchema', () => {
  it('accepts a minimal valid row', () => {
    expect(workoutCompletedSchema.safeParse(valid()).success).toBe(true);
  });

  it('accepts tssStatus="computed" with a numeric actualTss', () => {
    const r = workoutCompletedSchema.safeParse(
      valid({ actualTss: 88, tssStatus: 'computed' }),
    );
    expect(r.success).toBe(true);
  });

  it('accepts tssStatus="pending_inference" with no actualTss', () => {
    // ETA-25 Strava ingest before AthleteProfile thresholds exist.
    const r = workoutCompletedSchema.safeParse(valid({ tssStatus: 'pending_inference' }));
    expect(r.success).toBe(true);
  });

  it('rejects an unknown tssStatus value', () => {
    const r = workoutCompletedSchema.safeParse(
      valid({ tssStatus: 'unknown' as unknown as 'computed' }),
    );
    expect(r.success).toBe(false);
  });

  it('rejects unknown workout codes', () => {
    const r = workoutCompletedSchema.safeParse(
      valid({ workoutCode: 'X/NOPE' as unknown as 'C/AE2' }),
    );
    expect(r.success).toBe(false);
  });
});
