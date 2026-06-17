import { describe, expect, it } from 'vitest';
import type { WorkoutsCompletedRow } from '../schema/workouts-completed.js';
import { rowToWorkoutCompleted } from './workouts-completed.repository.js';

function row(overrides: Partial<WorkoutsCompletedRow> = {}): WorkoutsCompletedRow {
  return {
    id: 'row-id',
    userId: 'user-id',
    source: 'strava',
    externalId: 'ext-1',
    date: '2026-06-10',
    discipline: 'bike',
    workoutCode: null,
    actualTss: '50.00',
    tssStatus: 'computed',
    plannedTss: null,
    plannedDurationSeconds: null,
    actualDurationSeconds: 3600,
    perceivedExertion: null,
    notes: null,
    raw: {} as never,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as WorkoutsCompletedRow;
}

describe('rowToWorkoutCompleted', () => {
  it('converts a bike row with all fields populated', () => {
    const out = rowToWorkoutCompleted(row({ perceivedExertion: 7, notes: 'good ride' }));
    expect(out.date).toBe('2026-06-10');
    expect(out.discipline).toBe('bike');
    expect(out.actualTss).toBe(50);
    expect(out.tssStatus).toBe('computed');
    expect(out.perceivedExertion).toBe(7);
    expect(out.notes).toBe('good ride');
    expect(out.actualDurationSeconds).toBe(3600);
    expect(out.workoutCode).toBe('B/AE1'); // sentinel for bike when row.workoutCode is null
  });

  it('uses run sentinel when discipline=run and workoutCode is null', () => {
    const out = rowToWorkoutCompleted(row({ discipline: 'run' }));
    expect(out.workoutCode).toBe('C/AE1');
  });

  it('uses swim sentinel when discipline=swim and workoutCode is null', () => {
    const out = rowToWorkoutCompleted(row({ discipline: 'swim' }));
    expect(out.workoutCode).toBe('D/AE1');
  });

  it('preserves workoutCode when present (overrides sentinel)', () => {
    const out = rowToWorkoutCompleted(row({ workoutCode: 'B/SS1' }));
    expect(out.workoutCode).toBe('B/SS1');
  });

  it('converts null actualTss to undefined', () => {
    const out = rowToWorkoutCompleted(row({ actualTss: null, tssStatus: 'pending_inference' }));
    expect(out.actualTss).toBeUndefined();
    expect(out.tssStatus).toBe('pending_inference');
  });
});
