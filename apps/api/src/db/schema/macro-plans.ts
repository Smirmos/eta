import { type MacroPlan } from '@eta/shared-types';
import { date, index, jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { athleteProfiles } from './athlete-profile.js';

/**
 * One row per LLM-generated macro plan. Append-only — re-running Pass 1 inserts
 * a new row. The full MacroPlan is stored as JSONB; `race_date` is denormalised
 * for filtering. JSONB roundtrip turns Date instances into ISO strings — always
 * pass `data` through `planSchema` before use.
 */
export const macroPlans = pgTable(
  'macro_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // TODO(eta-future): replace with FK to users table.
    userId: uuid('user_id').notNull(),

    athleteProfileId: uuid('athlete_profile_id')
      .notNull()
      .references(() => athleteProfiles.id, { onDelete: 'restrict' }),

    raceDate: date('race_date').notNull(),

    data: jsonb('data').$type<MacroPlan>().notNull(),

    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    userIdIdx: index('macro_plans_user_id_idx').on(table.userId),
    athleteProfileIdx: index('macro_plans_athlete_profile_idx').on(table.athleteProfileId),
  }),
);

export type MacroPlanRow = typeof macroPlans.$inferSelect;
export type NewMacroPlanRow = typeof macroPlans.$inferInsert;
