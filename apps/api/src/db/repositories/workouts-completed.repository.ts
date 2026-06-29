import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gte, lte } from 'drizzle-orm';
import type { Discipline, WorkoutCode, WorkoutCompleted } from '@eta/shared-types';
import { DB, type Db } from '../db.module.js';
import {
  workoutsCompleted,
  type NewWorkoutsCompletedRow,
  type WorkoutsCompletedRow,
} from '../schema/workouts-completed.js';

@Injectable()
export class WorkoutsCompletedRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  /**
   * Upsert on (source, external_id). Re-ingesting the same Strava activity
   * (e.g., webhook 'update' event) overwrites the prior row.
   */
  async upsert(row: NewWorkoutsCompletedRow): Promise<WorkoutsCompletedRow> {
    const [out] = await this.db
      .insert(workoutsCompleted)
      .values(row)
      .onConflictDoUpdate({
        target: [workoutsCompleted.source, workoutsCompleted.externalId],
        set: {
          userId: row.userId,
          date: row.date,
          discipline: row.discipline,
          workoutCode: row.workoutCode,
          actualTss: row.actualTss,
          tssStatus: row.tssStatus,
          plannedTss: row.plannedTss,
          plannedDurationSeconds: row.plannedDurationSeconds,
          actualDurationSeconds: row.actualDurationSeconds,
          perceivedExertion: row.perceivedExertion,
          notes: row.notes,
          raw: row.raw,
        },
      })
      .returning();
    if (!out) throw new Error('Upsert into workouts_completed returned no row');
    return out;
  }

  async findBySourceAndExternalId(
    source: string,
    externalId: string,
  ): Promise<WorkoutsCompletedRow | null> {
    const rows = await this.db
      .select()
      .from(workoutsCompleted)
      .where(and(eq(workoutsCompleted.source, source), eq(workoutsCompleted.externalId, externalId)))
      .limit(1);
    return rows[0] ?? null;
  }

  async findByUserAndDateRange(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<WorkoutsCompletedRow[]> {
    return this.db
      .select()
      .from(workoutsCompleted)
      .where(
        and(
          eq(workoutsCompleted.userId, userId),
          gte(workoutsCompleted.date, startDate),
          lte(workoutsCompleted.date, endDate),
        ),
      );
  }

  async findPendingByUserAndSource(userId: string, source: string): Promise<WorkoutsCompletedRow[]> {
    return this.db
      .select()
      .from(workoutsCompleted)
      .where(
        and(
          eq(workoutsCompleted.userId, userId),
          eq(workoutsCompleted.source, source),
          eq(workoutsCompleted.tssStatus, 'pending_inference'),
        ),
      );
  }

  /**
   * Return canonical-shaped completed workouts for a user in [fromDate, toDate).
   * Strava-only rows substitute discipline-based sentinel workoutCodes.
   */
  async findCanonicalForUserAndDateRange(
    userId: string,
    fromDate: string,
    toDate: string,
  ): Promise<WorkoutCompleted[]> {
    const rows = await this.findByUserAndDateRange(userId, fromDate, toDate);
    return rows.map(rowToWorkoutCompleted);
  }
}

function sentinelWorkoutCodeForDiscipline(d: Discipline): WorkoutCode {
  if (d === 'bike') return 'B/AE1';
  if (d === 'run') return 'C/AE1';
  return 'D/AE1'; // swim
}

/**
 * Convert a DB row into the canonical `WorkoutCompleted` shape.
 * Strava-ingested rows have `workoutCode=null`; we substitute a discipline-
 * specific sentinel so the strict `WorkoutCode` union holds. Downstream Pass 3
 * postprocess discards these as non-plan-matches.
 */
export function rowToWorkoutCompleted(row: WorkoutsCompletedRow): WorkoutCompleted {
  return {
    date: row.date,
    workoutCode:
      (row.workoutCode as WorkoutCode | null) ??
      sentinelWorkoutCodeForDiscipline(row.discipline as Discipline),
    actualTss: row.actualTss !== null ? Number(row.actualTss) : undefined,
    tssStatus: (row.tssStatus as 'computed' | 'pending_inference' | undefined) ?? undefined,
    perceivedExertion: row.perceivedExertion ?? undefined,
    notes: row.notes ?? undefined,
    discipline: row.discipline as Discipline,
    actualDurationSeconds: row.actualDurationSeconds ?? undefined,
  };
}
