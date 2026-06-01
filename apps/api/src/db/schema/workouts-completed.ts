import {
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Persistence for canonical WorkoutCompleted (ETA-32 schema). Strava (ETA-25)
 * is the first writer; manual entry, Garmin, etc. plug in via the `source`
 * column without schema change.
 *
 * Mapping from canonical type to columns:
 *  - workoutCode is NULLABLE here — Strava activities arrive without a plan
 *    match; the join-to-plan step (post-ingest) fills it. The canonical type
 *    keeps workoutCode required, which forces a NULL check when hydrating
 *    rows back into the in-memory shape.
 *  - actualTss is NULL while tssStatus = 'pending_inference' (e.g., ingested
 *    before AthleteProfile thresholds were set).
 *  - raw holds the full provider activity payload so re-normalization is
 *    possible without re-fetching.
 */
export const workoutsCompleted = pgTable(
  'workouts_completed',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // TODO(eta-future): foreign-key to a users table once it exists.
    userId: uuid('user_id').notNull(),

    /** Provider slug — 'strava', 'manual', … */
    source: text('source').notNull(),

    /** Provider-native activity identifier (Strava activity.id as string). */
    externalId: text('external_id').notNull(),

    date: date('date').notNull(),
    discipline: text('discipline').notNull(),

    /** NULL until the join-to-plan step matches this row to a planned workout. */
    workoutCode: text('workout_code'),

    actualTss: numeric('actual_tss'),
    tssStatus: text('tss_status').notNull(),

    plannedTss: numeric('planned_tss'),
    plannedDurationSeconds: integer('planned_duration_seconds'),
    actualDurationSeconds: integer('actual_duration_seconds'),
    perceivedExertion: integer('perceived_exertion'),

    notes: text('notes'),

    /** Full provider activity payload (Strava /activities/{id} response). */
    raw: jsonb('raw').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    sourceExternalUnique: uniqueIndex('workouts_completed_source_external_unique').on(
      table.source,
      table.externalId,
    ),
    userDateIdx: index('workouts_completed_user_date_idx').on(table.userId, table.date),
  }),
);

export type WorkoutsCompletedRow = typeof workoutsCompleted.$inferSelect;
export type NewWorkoutsCompletedRow = typeof workoutsCompleted.$inferInsert;
