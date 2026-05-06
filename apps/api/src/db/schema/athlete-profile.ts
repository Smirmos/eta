import { type AthleteProfile } from '@eta/shared-types';
import { index, jsonb, pgEnum, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

// PostgreSQL enums mirroring ProfileSource and ConfidenceLevel from shared-types.
// We persist a denormalized copy of these on the row (alongside the JSONB blob)
// so they can be filtered/indexed without a JSONB extraction.

export const profileSourceEnum = pgEnum('profile_source', [
  'strava_inferred',
  'questionnaire',
  'mixed',
]);

export const confidenceLevelEnum = pgEnum('confidence_level', ['high', 'medium', 'low']);

/**
 * Persistence shape for AthleteProfile.
 *
 * The full profile is stored as a single JSONB blob in `data`. Justification:
 * the schema is deeply nested, will evolve, and is always read whole.
 * Relational decomposition is premature for v1.
 *
 * The .$type<AthleteProfile>() annotation is a TypeScript hint, not a runtime
 * guarantee — JSONB roundtrip turns Date instances into ISO strings. Always
 * pass values read from this column through `athleteProfileSchema` before use.
 */
export const athleteProfiles = pgTable(
  'athlete_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // TODO(eta-future): replace with a foreign key to a `users` table once it exists.
    // Kept as a non-FK uuid column for now so this migration can land before user auth.
    userId: uuid('user_id').notNull(),

    data: jsonb('data').$type<AthleteProfile>().notNull(),

    source: profileSourceEnum('source').notNull(),
    overallConfidence: confidenceLevelEnum('overall_confidence').notNull(),

    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    userIdIdx: index('athlete_profiles_user_id_idx').on(table.userId),
  }),
);

export type AthleteProfileRow = typeof athleteProfiles.$inferSelect;
export type NewAthleteProfileRow = typeof athleteProfiles.$inferInsert;
