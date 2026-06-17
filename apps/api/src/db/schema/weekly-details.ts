import { type WeeklyDetail } from '@eta/shared-types';
import { date, index, integer, jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { macroPlans } from './macro-plans.js';

/**
 * One row per Pass 2 generation. Append-only — re-running Pass 2 for the same
 * week inserts a new row. `findLatestForMacroPlan` uses DISTINCT ON (week_number).
 * Cascade delete from `macro_plans` so a parent removal cleans up children.
 */
export const weeklyDetails = pgTable(
  'weekly_details',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    macroPlanId: uuid('macro_plan_id')
      .notNull()
      .references(() => macroPlans.id, { onDelete: 'cascade' }),

    weekNumber: integer('week_number').notNull(),
    weekStartDate: date('week_start_date').notNull(),

    data: jsonb('data').$type<WeeklyDetail>().notNull(),

    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    macroPlanWeekIdx: index('weekly_details_macro_plan_week_idx').on(
      table.macroPlanId,
      table.weekNumber,
    ),
  }),
);

export type WeeklyDetailRow = typeof weeklyDetails.$inferSelect;
export type NewWeeklyDetailRow = typeof weeklyDetails.$inferInsert;
